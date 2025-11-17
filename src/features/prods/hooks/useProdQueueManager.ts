import { useState, useRef, useCallback, useReducer, useEffect } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueItem, QueueState, QueueAction } from "@/types/queue";
import type { getTimingConfig } from "@/lib/demoMode";
import { generateProdWithTimeout } from "@/features/prods/services/prodClient";
import { shouldProcessSentence } from "@/lib/shouldProcessSentence";
import { normalizeText, hasRecent, markNow, cleanupOlderThan } from "@/lib/dedup";
import { splitIntoSentences } from "@/lib/sentences";
import { debug } from "@/lib/debug";

interface OngoingRequest {
    id: string;
    controller: AbortController;
    startTime: number;
    sentenceId: string;
    topicVersion: number;
}

// Guard against stale sentence references (e.g., user never pauses long enough for
// useSentenceTracker's debounce). Re-derive the matching sentence from the latest
// full text so dedupe keys (sentence.id) advance as punctuation-less text grows.
export function resolveLatestSentence(fullText: string, fallback: Sentence): Sentence {
    if (!fullText || !fullText.trim()) return fallback;

    const latestSentences = splitIntoSentences(fullText);
    if (latestSentences.length === 0) {
        return fallback;
    }

    const sameStart = latestSentences.find((s) => s.startIndex === fallback.startIndex);
    if (sameStart) {
        return sameStart;
    }

    const normalizedFallback = normalizeText(fallback.text);
    const normalizedMatch = latestSentences.find(
        (s) => normalizeText(s.text) === normalizedFallback
    );

    return normalizedMatch ?? latestSentences[latestSentences.length - 1];
}

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
    switch (action.type) {
        case 'ENQUEUE': {
            return {
                ...state,
                items: [...state.items, { ...action.payload, status: 'pending' }]
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
        case 'COMPLETE_PROCESSING': {
            const remaining = state.items.filter(item => item.id !== action.payload);
            const stillProcessing = remaining.some(item => item.status === 'processing');
            return {
                ...state,
                items: remaining,
                isProcessing: stillProcessing
            };
        }
        case 'FAIL_PROCESSING': {
            const remaining = state.items.filter(item => item.id !== action.payload);
            const stillProcessing = remaining.some(item => item.status === 'processing');
            return {
                ...state,
                items: remaining,
                isProcessing: stillProcessing
            };
        }
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
    // Enqueue guard: prevents duplicate queue entries (shorter window: 15s write, 60s demo)
    const enqueueGuardMapRef = useRef<Map<string, number>>(new Map());

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
            const recentText = fullText.slice(-300); // Last 300 characters of the full text
            const data = await generateProdWithTimeout({
                lastParagraph: sentence.text,
                recentText,
                keywords: topicKeywords,
                recentProds: prods.slice(-3).map(p => p.text), // Last 3 prods for context
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
                const displayGuardTimeout = isDemoMode ? 30000 : 10000;
                cleanupOlderThan(displayGuardMapRef.current, displayGuardTimeout, nowTs);
                markNow(displayGuardMapRef.current, norm, nowTs);
            } catch { }
            setProds((prev) => {
                // Keep existing prods so they can finish their fade lifecycle before removal
                return [...prev, newProd];
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
            let pendingItems = queueState.items.filter(item => item.status === 'pending');
            const processingCount = queueState.items.filter(item => item.status === 'processing').length;

            if (pendingItems.length === 0) {
                if (processingCount === 0) {
                    debug.devProds(`${config.emoji} 📭 No pending items in queue`);
                }
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

            const maxParallel = isDemoMode ? 3 : 2;
            const availableSlots = Math.max(0, maxParallel - processingCount);

            if (availableSlots === 0) {
                debug.devProds(`${config.emoji} ⏳ Queue at capacity (${processingCount}/${maxParallel})`);
                return;
            }

            const itemsToProcess = pendingItems.slice(-availableSlots);
            debug.devProds(`${config.emoji} 🔄 Launching ${itemsToProcess.length} queue item(s)`);
            await Promise.all(itemsToProcess.map(item => processSingleItem(item)));
        };

        processQueue();
    }, [queueState.items, processSingleItem, isDemoMode, config.emoji]);

    // Public API to add sentences to queue
    // Display guard: prevents duplicate visible prods (30s demo vs 10s write)
    const displayGuardMapRef = useRef<Map<string, number>>(new Map());

    const enqueueSentence = useCallback((fullText: string, initialSentence: Sentence, opts?: { force?: boolean }) => {
        const sentence = resolveLatestSentence(fullText, initialSentence);
        debug.prods(`${config.emoji} 📝 enqueueSentence called for sentence:`, sentence.text.substring(0, 50) + "...");

        const now = Date.now();
        const sentenceText = sentence.text.trim();
        const normalized = normalizeText(sentenceText);
        const displayGuardTimeout = isDemoMode ? 30000 : 10000; // 30s demo vs 10s write

        // Early exit: check if this sentence text already has a recent prod
        if (hasRecent(displayGuardMapRef.current, normalized, displayGuardTimeout, now)) {
            debug.prods(`${config.emoji} 🚫 Prod already exists for this text recently, blocking:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Clean old fingerprints and keep them at least as long as the guard window (60s demo / 30s write)
        const enqueueTimeout = isDemoMode ? 60000 : 15000; // 60s in demo vs 15s in prod (prevent demo overlaps)
        const cleanupThreshold = Math.max(enqueueTimeout, 30000);
        cleanupOlderThan(enqueueGuardMapRef.current, cleanupThreshold, now);

        // Skip if we've processed this sentence ID recently (much longer timeout in demo mode)
        const lastProcessedAt = enqueueGuardMapRef.current.get(sentence.id);
        if (lastProcessedAt && now - lastProcessedAt < enqueueTimeout) {
            debug.prods(`${config.emoji} 🔄 Sentence processed recently, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Pre-filter sentences to skip obvious non-candidates
        if (!opts?.force && !shouldProcessSentence(sentence)) {
            debug.prods(`${config.emoji} ⏭️ Skipping sentence:`, sentence.text);
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

        // Mark this sentence ID as being processed
        markNow(enqueueGuardMapRef.current, sentence.id, now);

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
        enqueueGuardMapRef.current.clear();
        displayGuardMapRef.current.clear();
    }, [clearQueue, config]);

    // Handle topic shift - cancel relevant requests
    const handleTopicShift = useCallback(() => {
        debug.devProds(`${config.emoji} 🌟 Topic shift detected — cancelling and clearing queue`);
        // Cancel all in-flight requests and clear pending items so no stale prods surface
        cancelAllRequests();
        queueDispatch({ type: 'CLEAR_QUEUE' });

        // Clear enqueue and display guard maps for fresh start
        enqueueGuardMapRef.current.clear();
        displayGuardMapRef.current.clear();

        debug.devProds(`${config.emoji} 🗑️ Cleared all prod-related state for topic shift`);
    }, [cancelAllRequests, config]);

    // Clear cached sentences (for new writing sessions)
    const clearFilteredSentences = useCallback(() => {
        debug.prods(`${config.emoji} 🗑️ Clearing cached filtered sentences`);
        setFilteredSentences([]);
        // Also clear guard maps when clearing sentences
        enqueueGuardMapRef.current.clear();
    }, [config]);

    return {
        prods,
        enqueueSentence,
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
