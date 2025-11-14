import { useState, useRef, useCallback, useReducer, useEffect } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueItem, QueueState, QueueAction } from "@/types/queue";
import type { getTimingConfig } from "@/lib/demoMode";
import { generateProdWithTimeout } from "@/services/prodClient";
import { shouldProcessSentence } from "@/lib/shouldProcessSentence";
import { normalizeText, makeFingerprint, hasRecent, markNow, cleanupOlderThan } from "@/lib/dedup";
import { debug } from "@/lib/debug";

interface OngoingRequest {
    id: string;
    controller: AbortController;
    startTime: number;
    sentenceId: string;
    topicVersion: number;
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
    switch (action.type) {
        case 'ENQUEUE': {
            // Keep all existing items except pending ones, then append the new pending item
            const nonPendingItems = state.items.filter(item => item.status !== 'pending');
            return {
                ...state,
                items: [...nonPendingItems, { ...action.payload, status: 'pending' }]
            };
        }
        case 'START_PROCESSING':
            return {
                ...state,
                isProcessing: true,
                items: state.items.map(item =>
                    item.id === action.payload
                        ? { ...item, status: 'processing' }
                        : item
                )
            };
        case 'COMPLETE_PROCESSING':
            return {
                ...state,
                items: state.items.filter(item => item.id !== action.payload)
            };
        case 'FAIL_PROCESSING':
            return {
                ...state,
                items: state.items.filter(item => item.id !== action.payload)
            };
        case 'SET_PROCESSING':
            return {
                ...state,
                isProcessing: action.payload
            };
        case 'CLEAR_QUEUE':
            return {
                items: [],
                isProcessing: false
            };
        default:
            return state;
    }
}

type TimingConfig = ReturnType<typeof getTimingConfig>;

interface UseProdQueueManagerOptions {
    config: TimingConfig;
    isDemoMode: boolean;
    topicKeywords?: string[];
    topicVersion?: number;
}

export function useProdQueueManager({
    config,
    isDemoMode,
    topicKeywords = [],
    topicVersion,
}: UseProdQueueManagerOptions) {
    const [prods, setProds] = useState<Prod[]>([]);
    const [queueState, queueDispatch] = useReducer(queueReducer, {
        items: [],
        isProcessing: false
    });
    const [filteredSentences, setFilteredSentences] = useState<Sentence[]>([]);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const pinnedIdsRef = useRef<Set<string>>(new Set());

    const nextAvailableAtRef = useRef<number>(0);
    const ongoingRequestsRef = useRef<Map<string, OngoingRequest>>(new Map());
    const latestTopicVersionRef = useRef<number>(topicVersion ?? 0);
    const sentenceFingerprintsRef = useRef<Map<string, number>>(new Map());

    // Track latest topic version for staleness gating
    useEffect(() => {
        if (typeof topicVersion === 'number') {
            latestTopicVersionRef.current = topicVersion;
        }
    }, [topicVersion]);

    // Helper to wait for rate limit window
    const waitForRateLimit = useCallback(async (delayMs: number) => {
        const now = Date.now();
        const waitTime = Math.max(0, nextAvailableAtRef.current - now);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        nextAvailableAtRef.current = Date.now() + delayMs;
    }, []);

    // (Removed) cancelRequestsForSentences was unused; we cancel wholesale on topic shifts for simplicity

    // Cancel all ongoing requests
    const cancelAllRequests = useCallback(() => {
        const requestCount = ongoingRequestsRef.current.size;
        ongoingRequestsRef.current.forEach(request => {
            request.controller.abort();
        });
        ongoingRequestsRef.current.clear();
        if (requestCount > 0) {
            debug.dev(`🗑️ Cancelled all ${requestCount} ongoing requests`);
        }
    }, []);

    // Process a single queue item with cancellation support
    const processSingleItem = useCallback(async (item: QueueItem) => {
        const { fullText, sentence, id } = item;
        const requestId = `req-${id}`;

        // Create AbortController for this request
        const controller = new AbortController();
        const ongoingRequest: OngoingRequest = {
            id: requestId,
            controller,
            startTime: Date.now(),
            sentenceId: sentence.id,
            topicVersion: latestTopicVersionRef.current,
        };

        ongoingRequestsRef.current.set(requestId, ongoingRequest);

        try {
            queueDispatch({ type: 'START_PROCESSING', payload: id });
            const age = Date.now() - item.timestamp;
            debug.devProds("🤖 Processing sentence:", sentence.text, `| age: ${age}ms`);

            // Rate limiting: wait before making API calls
            await waitForRateLimit(config.rateLimitMs);

            // Enhanced API call with timeout and cancellation
            const apiStart = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
            const data = await generateProdWithTimeout({
                lastParagraph: sentence.text,
                fullText: fullText,
                recentProds: prods.slice(-5).map(p => p.text), // Last 5 prods for context
                topicKeywords, // Current topic keywords
            }, { signal: controller.signal });

            const apiElapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - apiStart;

            debug.devProds("🎯 Enhanced API result:", data);

            // Staleness gate: discard if topic changed since request started
            const req = ongoingRequestsRef.current.get(requestId);
            const topicChanged = req && req.topicVersion !== latestTopicVersionRef.current;
            if (topicChanged) {
                debug.devProds("🗑️ Discarding stale prod due to topic change");
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Confidence gating: very permissive in demo mode, but bypass if force is true
            const confidenceThreshold = isDemoMode ? 0.05 : 0.5; // Even lower threshold for demo mode
            if (!item.force && typeof data?.confidence === 'number' && data.confidence <= confidenceThreshold) {
                debug.devProds(`🔕 Low confidence (${data.confidence.toFixed(2)}) – skipping prod for sentence:`, sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Ensure we have valid selected prod text (unless force is true)
            const selectedProdText = data?.selectedProd;
            if (!item.force && (!selectedProdText || typeof selectedProdText !== 'string' || !selectedProdText.trim())) {
                debug.dev(`⚠️ No valid selected prod text | api: ${Math.round(apiElapsed)}ms`);
                queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Create final prod with selected text (or fallback for forced prods)
            const prodText = selectedProdText?.trim() || (item.force ? "Demo prod triggered!" : "");
            const newProd: Prod = {
                id: `prod-${sentence.id}-${Date.now()}`,
                text: prodText,
                sentenceId: sentence.id,
                sourceText: sentence.text,
                timestamp: Date.now(),
            };

            debug.devProds(`${config.emoji} ✅ Completed | api: ${Math.round(apiElapsed)}ms | prod:`, newProd);
            // Mark this sentence text as recently produced to avoid overlaps
            const norm = normalizeText(sentence.text);
            const nowTs = Date.now();
            try {
                cleanupOlderThan(recentSentenceTextMapRef.current, 120000, nowTs);
                markNow(recentSentenceTextMapRef.current, norm, nowTs);
            } catch { }
            setProds((prev) => {
                const keepPinned = prev.filter(p => pinnedIdsRef.current.has(p.id));
                // More aggressive clearing: keep only pinned prods and the new one
                if (prev.length > keepPinned.length + 1) {
                    debug.prods(`${config.emoji} 🗑️ Clearing ${prev.length - keepPinned.length - 1} old prods`);
                }
                return [...keepPinned, newProd];
            });
            queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
            ongoingRequestsRef.current.delete(requestId);

        } catch (error) {
            ongoingRequestsRef.current.delete(requestId);

            // Check if it was cancelled
            if (error instanceof Error && error.name === 'AbortError') {
                debug.devProds("🚫 Request was cancelled for sentence:", sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                return;
            }

            debug.error("❌ Prod pipeline error:", error);
            queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
        }
    }, [waitForRateLimit, prods, topicKeywords]);

    // Process queue sequentially with cancellation support (single-flight)
    useEffect(() => {
        const processQueue = async () => {
            if (queueState.isProcessing) {
                debug.devProds("⏸️ Queue is already processing, skipping");
                return;
            }

            let pendingItems = queueState.items.filter(item => item.status === 'pending');
            if (pendingItems.length === 0) {
                debug.devProds(`${config.emoji} 📭 No pending items in queue`);
                return;
            }

            // Implement max queue size - keep only the most recent items (more in demo mode)
            const MAX_QUEUE_SIZE = isDemoMode ? 5 : 3; // Allow more queued items in demo mode
            if (pendingItems.length > MAX_QUEUE_SIZE) {
                const itemsToRemove = pendingItems.slice(0, pendingItems.length - MAX_QUEUE_SIZE);
                itemsToRemove.forEach(item => {
                    queueDispatch({ type: 'COMPLETE_PROCESSING', payload: item.id });
                });
                pendingItems = pendingItems.slice(-MAX_QUEUE_SIZE);
                debug.devProds(`${config.emoji} 🗑️ Pruned queue to ${MAX_QUEUE_SIZE} most recent items`);
            }

            debug.devProds(`${config.emoji} 🔄 Processing most recent pending item`);
            queueDispatch({ type: 'SET_PROCESSING', payload: true });
            // Process the most recent pending item (LIFO)
            const nextItem = pendingItems[pendingItems.length - 1];
            await processSingleItem(nextItem);

            queueDispatch({ type: 'SET_PROCESSING', payload: false });
        };

        processQueue();
    }, [queueState.items, queueState.isProcessing, processSingleItem]);

    // Public API to add sentences to queue
    const recentSentenceTextMapRef = useRef<Map<string, number>>(new Map());

    // Helper: directly inject a prod without hitting the API (kept for flexibility)
    const injectProd = useCallback((fullText: string, sentence: Sentence, prodText: string) => {
        const now = Date.now();
        const normalized = normalizeText(sentence.text);

        // Skip if a prod already exists for this sentence id very recently
        const recentProdForSentence = prods.find(p => p.sentenceId === sentence.id && now - p.timestamp < 5000);
        if (recentProdForSentence) return;

        // Skip if we've produced for this exact text recently (longer timeout for demo chips)
        const lastProducedAt = recentSentenceTextMapRef.current.get(normalized);
        const demoChipTimeout = isDemoMode ? 120000 : 30000; // 2min for demo chips vs 30s for normal prods
        if (lastProducedAt && now - lastProducedAt < demoChipTimeout) {
            debug.prods(`${config.emoji} 🚫 Skipping duplicate prod for recently produced text:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        const newProd: Prod = {
            id: `prod-${sentence.id}-${now}`,
            text: prodText.trim(),
            sentenceId: sentence.id,
            sourceText: sentence.text,
            timestamp: now,
        };

        // Mark this sentence text as recently processed to avoid overlaps
        try {
            cleanupOlderThan(recentSentenceTextMapRef.current, 120000, now);
            markNow(recentSentenceTextMapRef.current, normalized, now);
            // Also mark the fingerprint as processed to prevent normal prod system from processing it
            const fingerprint = makeFingerprint(sentence.text);
            markNow(sentenceFingerprintsRef.current, fingerprint, now);
        } catch { }

        setProds((prev) => {
            const keepPinned = prev.filter(p => pinnedIdsRef.current.has(p.id));
            return [...keepPinned, newProd];
        });
    }, [prods]);

    const enqueueSentence = useCallback((fullText: string, sentence: Sentence, opts?: { force?: boolean }) => {
        debug.prods(`${config.emoji} 📝 enqueueSentence called for sentence:`, sentence.text.substring(0, 50) + "...");

        // Clean old fingerprints (>30s) periodically
        const now = Date.now();
        const cleanupThreshold = 30000;

        // Early exit: check if this sentence text already has a recent prod
        const normalizedText = sentence.text.trim().toLowerCase();
        const lastProducedAtEarly = recentSentenceTextMapRef.current.get(normalizedText);
        const recentProdTimeout = isDemoMode ? 120000 : 30000; // 2min in demo vs 30s in prod
        if (lastProducedAtEarly && now - lastProducedAtEarly < recentProdTimeout) {
            debug.prods(`${config.emoji} 🚫 Prod already exists for this text recently, blocking:`, sentence.text.substring(0, 50) + "...");
            return;
        }
        cleanupOlderThan(sentenceFingerprintsRef.current, cleanupThreshold, now);

        // Create sentence fingerprint for deduplication
        const sentenceText = sentence.text.trim();
        const fingerprint = makeFingerprint(sentenceText);

        // Skip if we've processed this fingerprint recently (much longer timeout in demo mode)
        const lastProcessedAt = sentenceFingerprintsRef.current.get(fingerprint);
        const fingerprintTimeout = isDemoMode ? 60000 : 15000; // 60s in demo vs 15s in prod (prevent demo overlaps)
        if (lastProcessedAt && now - lastProcessedAt < fingerprintTimeout) {
            debug.prods(`${config.emoji} 🔄 Similar sentence processed recently, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Pre-filter sentences to skip obvious non-candidates
        if (!opts?.force && !shouldProcessSentence(sentence)) {
            debug.prods(`${config.emoji} ⏭️ Skipping sentence:`, sentence.text);
            return;
        }

        // Normalize sentence text for robust de-duplication
        const normalized = normalizeText(sentenceText);

        // Skip if we've produced for this text recently (much longer timeout in demo mode)
        const textTimeout = isDemoMode ? 30000 : 10000; // 30s in demo vs 10s in prod (prevent overlaps with demo chips)
        if (hasRecent(recentSentenceTextMapRef.current, normalized, textTimeout, now)) {
            debug.prods(`${config.emoji} 🔄 Recent prod already shown for this sentence text, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Cancel any existing requests for this sentence to prevent stale prods
        for (const [requestId, request] of ongoingRequestsRef.current.entries()) {
            if (request.sentenceId === sentence.id) {
                debug.prods(`${config.emoji} 🚫 Cancelling existing request for sentence:`, sentence.text.substring(0, 50) + "...");
                request.controller.abort();
                ongoingRequestsRef.current.delete(requestId);
            }
        }

        // Simple duplicate check: if we already have a prod for this exact sentence id, skip
        const existingProd = prods.find(p => p.sentenceId === sentence.id);
        if (existingProd) {
            debug.prods(`${config.emoji} 🔄 Prod already exists for this sentence, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Check if we already have this sentence in the queue (pending or processing)
        const existingInQueue = queueState.items.some(item => item.sentence.text.trim().toLowerCase() === normalized);
        if (existingInQueue) {
            debug.prods(`${config.emoji} 🔄 Sentence already in queue, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Additional safety check: if we have any recent prod for this sentence ID, skip (less aggressive in demo mode)
        const recentProdForSentence = prods.find(p =>
            p.sentenceId === sentence.id && now - p.timestamp < (isDemoMode ? 2000 : 5000) // 2s in demo vs 5s in prod
        );
        if (recentProdForSentence) {
            debug.prods(`${config.emoji} 🔄 Recent prod exists for this sentence ID, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Mark this sentence fingerprint as being processed
        markNow(sentenceFingerprintsRef.current, fingerprint, now);

        // Cache filtered sentence for embedding reuse
        setFilteredSentences(prev => {
            // Check if sentence already exists to avoid duplicates
            const exists = prev.some(s => s.id === sentence.id);
            if (exists) return prev;

            debug.prods("💾 Caching filtered sentence for embeddings:", sentence.text.substring(0, 50) + "...");
            return [...prev, sentence];
        });

        const queueItem = {
            id: `queue-${sentence.id}-${Date.now()}`,
            fullText,
            sentence,
            timestamp: Date.now(),
            force: opts?.force,
        };

        debug.prods(`${config.emoji} 📝 Adding to queue:`, sentence.text.substring(0, 50) + "...");
        queueDispatch({ type: 'ENQUEUE', payload: queueItem });
    }, [queueState.items, prods, config]);

    const pinProd = useCallback((id: string) => {
        setPinnedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            pinnedIdsRef.current = next;
            return next;
        });
    }, []);

    const removeProd = useCallback((id: string) => {
        setProds((prev) => prev.filter(p => p.id !== id));
        setPinnedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            pinnedIdsRef.current = next;
            return next;
        });
    }, []);

    // Clear queue and cancel all requests
    const clearQueue = useCallback(() => {
        cancelAllRequests();
        queueDispatch({ type: 'CLEAR_QUEUE' });
    }, [cancelAllRequests]);

    const clearAll = useCallback(() => {
        debug.prods(`${config.emoji} 🧹 Clearing all prod state`);
        clearQueue();
        setProds([]);
        setFilteredSentences([]);
        setPinnedIds(() => {
            const cleared = new Set<string>();
            pinnedIdsRef.current = cleared;
            return cleared;
        });
        sentenceFingerprintsRef.current.clear();
        recentSentenceTextMapRef.current.clear();
    }, [clearQueue, config]);

    // Handle topic shift - cancel relevant requests
    const handleTopicShift = useCallback(() => {
        debug.devProds(`${config.emoji} 🌟 Topic shift detected — cancelling and clearing queue`);
        // Cancel all in-flight requests and clear pending items so no stale prods surface
        cancelAllRequests();
        queueDispatch({ type: 'CLEAR_QUEUE' });

        // Clear fingerprints and recent sentence maps for fresh start
        sentenceFingerprintsRef.current.clear();
        recentSentenceTextMapRef.current.clear();

        debug.devProds(`${config.emoji} 🗑️ Cleared all prod-related state for topic shift`);
    }, [cancelAllRequests, config]);

    // Clear cached sentences (for new writing sessions)
    const clearFilteredSentences = useCallback(() => {
        debug.prods(`${config.emoji} 🗑️ Clearing cached filtered sentences`);
        setFilteredSentences([]);
        // Also clear fingerprints when clearing sentences
        sentenceFingerprintsRef.current.clear();
    }, [config]);

    return {
        prods,
        enqueueSentence,
        injectProd,
        pinProd,
        removeProd,
        clearQueue,
        clearAll,
        handleTopicShift,
        queueState, // Expose queue state for UI feedback
        filteredSentences, // Expose cached sentences for embeddings
        clearFilteredSentences, // Allow clearing cache for new sessions
        pinnedIds, // Expose pinned prod IDs for collision system
    };
}
