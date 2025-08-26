import { useState, useRef, useCallback, useReducer, useEffect, useMemo } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueItem, QueueState, QueueAction } from "@/types/queue";
import { generateProdWithTimeout } from "@/services/prodClient";
import { shouldProcessSentence } from "@/lib/shouldProcessSentence";
import { useDemoMode, getTimingConfig } from "@/lib/demoMode";

const isDev = process.env.NODE_ENV !== "production";
const DEBUG_PRODS = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_PRODS === '1';

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

interface UseProdsOptions {
    onTopicShift?: () => void;
    topicKeywords?: string[];
    topicVersion?: number;
}

export function useProds(options: UseProdsOptions = {}) {
    const [prods, setProds] = useState<Prod[]>([]);
    const [prodDurations, setProdDurations] = useState<number[]>([]);
    const [queueState, queueDispatch] = useReducer(queueReducer, {
        items: [],
        isProcessing: false
    });
    const [filteredSentences, setFilteredSentences] = useState<Sentence[]>([]);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const pinnedIdsRef = useRef<Set<string>>(new Set());

    const isDemoMode = useDemoMode();
    const config = useMemo(() => getTimingConfig(isDemoMode), [isDemoMode]);

    const nextAvailableAtRef = useRef<number>(0);
    const ongoingRequestsRef = useRef<Map<string, OngoingRequest>>(new Map());
    const latestTopicVersionRef = useRef<number>(options.topicVersion ?? 0);
    const sentenceFingerprintsRef = useRef<Map<string, number>>(new Map());
    // Demo-only: block prefix for first sentence after injecting a demo chip
    const demoBlockedPrefixRef = useRef<{ prefix: string; until: number } | null>(null);

    // Track latest topic version for staleness gating
    useEffect(() => {
        if (typeof options.topicVersion === 'number') {
            latestTopicVersionRef.current = options.topicVersion;
        }
    }, [options.topicVersion]);

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
        if (requestCount > 0 && isDev) {
            console.log(`🗑️ Cancelled all ${requestCount} ongoing requests`);
        }
    }, []);

    // (Removed) stale guard is unnecessary with single-flight + pending-prune

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
            if (isDev && DEBUG_PRODS) {
                const age = Date.now() - item.timestamp;
                console.log("🤖 Processing sentence:", sentence.text, `| age: ${age}ms`);
            }

            // Rate limiting: wait before making API calls
            await waitForRateLimit(config.rateLimitMs);

            // Enhanced API call with timeout and cancellation
            const apiStart = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
            const data = await generateProdWithTimeout({
                lastParagraph: sentence.text,
                fullText: fullText,
                recentProds: prods.slice(-5).map(p => p.text), // Last 5 prods for context
                topicKeywords: options.topicKeywords, // Current topic keywords
            }, { signal: controller.signal });

            const apiElapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - apiStart;
            setProdDurations(prev => {
                const next = [...prev, apiElapsed];
                return next.length > 20 ? next.slice(-20) : next;
            });

            if (isDev && DEBUG_PRODS) console.log("🎯 Enhanced API result:", data);

            // Staleness gate: discard if topic changed since request started
            const req = ongoingRequestsRef.current.get(requestId);
            const topicChanged = req && req.topicVersion !== latestTopicVersionRef.current;
            if (topicChanged) {
                if (isDev && DEBUG_PRODS) console.log("🗑️ Discarding stale prod due to topic change");
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Confidence gating: very permissive in demo mode, but bypass if force is true
            const confidenceThreshold = isDemoMode ? 0.05 : 0.5; // Even lower threshold for demo mode
            if (!item.force && typeof data?.confidence === 'number' && data.confidence <= confidenceThreshold) {
                if (isDev && DEBUG_PRODS) console.log(`🔕 Low confidence (${data.confidence.toFixed(2)}) – skipping prod for sentence:`, sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Ensure we have valid selected prod text (unless force is true)
            const selectedProdText = data?.selectedProd;
            if (!item.force && (!selectedProdText || typeof selectedProdText !== 'string' || !selectedProdText.trim())) {
                if (isDev) console.log(`⚠️ No valid selected prod text | api: ${Math.round(apiElapsed)}ms`);
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

            if (isDev && DEBUG_PRODS) console.log(`${config.emoji} ✅ Completed | api: ${Math.round(apiElapsed)}ms | prod:`, newProd);
            // Mark this sentence text as recently produced to avoid overlaps
            const norm = sentence.text.trim().toLowerCase();
            const nowTs = Date.now();
            try {
                // Clean old entries (>2 minutes) - use Map.clear() + rebuild for better GC
                const validEntries: Array<[string, number]> = [];
                for (const [k, ts] of recentSentenceTextMapRef.current.entries()) {
                    if (nowTs - ts <= 120000) validEntries.push([k, ts]);
                }
                recentSentenceTextMapRef.current.clear();
                for (const [k, ts] of validEntries) {
                    recentSentenceTextMapRef.current.set(k, ts);
                }
                recentSentenceTextMapRef.current.set(norm, nowTs);
            } catch { }
            setProds((prev) => {
                const keepPinned = prev.filter(p => pinnedIdsRef.current.has(p.id));
                // More aggressive clearing: keep only pinned prods and the new one
                if (DEBUG_PRODS && prev.length > keepPinned.length + 1) {
                    console.log(`${config.emoji} 🗑️ Clearing ${prev.length - keepPinned.length - 1} old prods`);
                }
                return [...keepPinned, newProd];
            });
            queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
            ongoingRequestsRef.current.delete(requestId);

        } catch (error) {
            ongoingRequestsRef.current.delete(requestId);

            // Check if it was cancelled
            if (error instanceof Error && error.name === 'AbortError') {
                if (isDev && DEBUG_PRODS) console.log("🚫 Request was cancelled for sentence:", sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                return;
            }

            console.error("❌ Prod pipeline error:", error);
            queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
        }
    }, [waitForRateLimit, prods, options.topicKeywords]);

    // Process queue sequentially with cancellation support (single-flight)
    useEffect(() => {
        const processQueue = async () => {
            if (queueState.isProcessing) {
                if (isDev && DEBUG_PRODS) console.log("⏸️ Queue is already processing, skipping");
                return;
            }

            let pendingItems = queueState.items.filter(item => item.status === 'pending');
            if (pendingItems.length === 0) {
                if (isDev && DEBUG_PRODS) console.log(`${config.emoji} 📭 No pending items in queue`);
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
                if (isDev && DEBUG_PRODS) console.log(`${config.emoji} 🗑️ Pruned queue to ${MAX_QUEUE_SIZE} most recent items`);
            }

            if (isDev && DEBUG_PRODS) console.log(`${config.emoji} 🔄 Processing most recent pending item`);
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

    // Demo/helper: directly inject a prod without hitting the API (e.g., for typed demo phrase)
    const injectProd = useCallback((fullText: string, sentence: Sentence, prodText: string) => {
        const now = Date.now();
        const normalized = sentence.text.trim().toLowerCase();

        // Skip if a prod already exists for this sentence id very recently
        const recentProdForSentence = prods.find(p => p.sentenceId === sentence.id && now - p.timestamp < 5000);
        if (recentProdForSentence) return;

        // Skip if we've produced for this exact text recently (longer timeout for demo chips)
        const lastProducedAt = recentSentenceTextMapRef.current.get(normalized);
        const demoChipTimeout = isDemoMode ? 120000 : 30000; // 2min for demo chips vs 30s for normal prods
        if (lastProducedAt && now - lastProducedAt < demoChipTimeout) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🚫 Skipping duplicate prod for recently produced text:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        const newProd: Prod = {
            id: `prod-${sentence.id}-${now}`,
            text: prodText.trim(),
            sentenceId: sentence.id,
            sourceText: sentence.text,
            timestamp: now,
        };

        // Mark this sentence text as recently produced to avoid overlaps
        try {
            const validEntries: Array<[string, number]> = [];
            for (const [k, ts] of recentSentenceTextMapRef.current.entries()) {
                if (now - ts <= 120000) validEntries.push([k, ts]);
            }
            recentSentenceTextMapRef.current.clear();
            for (const [k, ts] of validEntries) recentSentenceTextMapRef.current.set(k, ts);
            recentSentenceTextMapRef.current.set(normalized, now);

            // Also mark the fingerprint as processed to prevent normal prod system from processing it
            const fingerprint = `${sentence.text.substring(0, 30).toLowerCase()}-${sentence.text.length}`;
            sentenceFingerprintsRef.current.set(fingerprint, now);

            // In demo mode, also block any future API prods for sentences that extend this prefix
            if (isDemoMode) {
                const prefix = sentence.text.trim().toLowerCase().slice(0, 60);
                // Block for 90s to be safe during demo
                demoBlockedPrefixRef.current = { prefix, until: now + 90_000 };
            }
        } catch { }

        setProds((prev) => {
            const keepPinned = prev.filter(p => pinnedIdsRef.current.has(p.id));
            return [...keepPinned, newProd];
        });
    }, [prods]);

    const callProdAPI = useCallback((fullText: string, sentence: Sentence, opts?: { force?: boolean }) => {
        if (DEBUG_PRODS) console.log(`${config.emoji} 📝 callProdAPI called for sentence:`, sentence.text.substring(0, 50) + "...");

        // Clean old fingerprints (>30s) periodically
        const now = Date.now();
        const cleanupThreshold = 30000;

        // Demo-only: if we recently injected a demo chip for this sentence's prefix, skip API call
        if (isDemoMode && demoBlockedPrefixRef.current && now < demoBlockedPrefixRef.current.until) {
            const prefix = demoBlockedPrefixRef.current.prefix;
            const sentenceNorm = sentence.text.trim().toLowerCase();
            if (sentenceNorm.startsWith(prefix)) {
                if (DEBUG_PRODS) console.log(`${config.emoji} 🎬 Skipping API due to demo prefix block`);
                return;
            }
        }

        // Early exit: check if this sentence text already has a recent prod
        const normalizedText = sentence.text.trim().toLowerCase();
        const lastProducedAtEarly = recentSentenceTextMapRef.current.get(normalizedText);
        const recentProdTimeout = isDemoMode ? 120000 : 30000; // 2min in demo vs 30s in prod
        if (lastProducedAtEarly && now - lastProducedAtEarly < recentProdTimeout) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🚫 Prod already exists for this text recently, blocking:`, sentence.text.substring(0, 50) + "...");
            return;
        }
        for (const [fingerprint, timestamp] of sentenceFingerprintsRef.current.entries()) {
            if (now - timestamp > cleanupThreshold) {
                sentenceFingerprintsRef.current.delete(fingerprint);
            }
        }

        // Create sentence fingerprint for deduplication
        const sentenceText = sentence.text.trim();
        const fingerprint = `${sentenceText.substring(0, 30).toLowerCase()}-${sentenceText.length}`;

        // Skip if we've processed this fingerprint recently (much longer timeout in demo mode)
        const lastProcessedAt = sentenceFingerprintsRef.current.get(fingerprint);
        const fingerprintTimeout = isDemoMode ? 60000 : 15000; // 60s in demo vs 15s in prod (prevent demo overlaps)
        if (lastProcessedAt && now - lastProcessedAt < fingerprintTimeout) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🔄 Similar sentence processed recently, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Pre-filter sentences to skip obvious non-candidates
        if (!opts?.force && !shouldProcessSentence(sentence)) {
            if (DEBUG_PRODS) console.log(`${config.emoji} ⏭️ Skipping sentence:`, sentence.text);
            return;
        }

        // Normalize sentence text for robust de-duplication
        const normalized = sentenceText.toLowerCase();

        // Skip if we've produced for this text recently (much longer timeout in demo mode)
        const lastProducedAt = recentSentenceTextMapRef.current.get(normalized);
        const textTimeout = isDemoMode ? 60000 : 20000; // 60s in demo vs 20s in prod (prevent overlaps with demo chips)
        if (lastProducedAt && now - lastProducedAt < textTimeout) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🔄 Recent prod already shown for this sentence text, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Cancel any existing requests for this sentence to prevent stale prods
        for (const [requestId, request] of ongoingRequestsRef.current.entries()) {
            if (request.sentenceId === sentence.id) {
                if (DEBUG_PRODS) console.log(`${config.emoji} 🚫 Cancelling existing request for sentence:`, sentence.text.substring(0, 50) + "...");
                request.controller.abort();
                ongoingRequestsRef.current.delete(requestId);
            }
        }

        // Simple duplicate check: if we already have a prod for this exact sentence id, skip
        const existingProd = prods.find(p => p.sentenceId === sentence.id);
        if (existingProd) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🔄 Prod already exists for this sentence, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Check if we already have this sentence in the queue (pending or processing)
        const existingInQueue = queueState.items.some(item => item.sentence.text.trim().toLowerCase() === normalized);
        if (existingInQueue) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🔄 Sentence already in queue, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Additional safety check: if we have any recent prod for this sentence ID, skip (less aggressive in demo mode)
        const recentProdForSentence = prods.find(p =>
            p.sentenceId === sentence.id && now - p.timestamp < (isDemoMode ? 2000 : 5000) // 2s in demo vs 5s in prod
        );
        if (recentProdForSentence) {
            if (DEBUG_PRODS) console.log(`${config.emoji} 🔄 Recent prod exists for this sentence ID, skipping:`, sentence.text.substring(0, 50) + "...");
            return;
        }

        // Mark this sentence fingerprint as being processed
        sentenceFingerprintsRef.current.set(fingerprint, now);

        // Cache filtered sentence for embedding reuse
        setFilteredSentences(prev => {
            // Check if sentence already exists to avoid duplicates
            const exists = prev.some(s => s.id === sentence.id);
            if (exists) return prev;

            if (DEBUG_PRODS) console.log("💾 Caching filtered sentence for embeddings:", sentence.text.substring(0, 50) + "...");
            return [...prev, sentence];
        });

        const queueItem = {
            id: `queue-${sentence.id}-${Date.now()}`,
            fullText,
            sentence,
            timestamp: Date.now(),
            force: opts?.force,
        };

        if (DEBUG_PRODS) console.log(`${config.emoji} 📝 Adding to queue:`, sentence.text.substring(0, 50) + "...");
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

    // Handle topic shift - cancel relevant requests
    const handleTopicShift = useCallback(() => {
        if (isDev && DEBUG_PRODS) console.log(`${config.emoji} 🌟 Topic shift detected — cancelling and clearing queue`);
        // Cancel all in-flight requests and clear pending items so no stale prods surface
        cancelAllRequests();
        queueDispatch({ type: 'CLEAR_QUEUE' });

        // Clear fingerprints and recent sentence maps for fresh start
        sentenceFingerprintsRef.current.clear();
        recentSentenceTextMapRef.current.clear();

        if (isDev && DEBUG_PRODS) console.log(`${config.emoji} 🗑️ Cleared all prod-related state for topic shift`);
        options.onTopicShift?.();
    }, [cancelAllRequests, options.onTopicShift, config]);

    // Clear cached sentences (for new writing sessions)
    const clearFilteredSentences = useCallback(() => {
        if (DEBUG_PRODS) console.log(`${config.emoji} 🗑️ Clearing cached filtered sentences`);
        setFilteredSentences([]);
        // Also clear fingerprints when clearing sentences
        sentenceFingerprintsRef.current.clear();
    }, [config]);

    return {
        prods,
        callProdAPI,
        injectProd,
        pinProd,
        removeProd,
        clearQueue,
        handleTopicShift,
        queueState, // Expose queue state for UI feedback
        filteredSentences, // Expose cached sentences for embeddings
        clearFilteredSentences, // Allow clearing cache for new sessions
        pinnedIds, // Expose pinned prod IDs for collision system
        prodMetrics: {
            durations: prodDurations,
            slowCount: prodDurations.filter((ms) => ms >= 5000).length,
            last: prodDurations.length ? prodDurations[prodDurations.length - 1] : null,
        },
    };
}
