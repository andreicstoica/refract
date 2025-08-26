import { useState, useRef, useCallback, useReducer, useEffect } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueItem, QueueState, QueueAction } from "@/types/queue";
import { generateProdWithTimeout } from "@/services/prodClient";
import { shouldProcessSentence } from "@/lib/shouldProcessSentence";

const isDev = process.env.NODE_ENV !== "production";

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
            // Keep only non-pending items (e.g., processing) and append the newest pending item
            const kept = state.items.filter(item => item.status !== 'pending');
            return {
                ...state,
                items: [...kept, { ...action.payload, status: 'pending' }]
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

    const nextAvailableAtRef = useRef<number>(0);
    const ongoingRequestsRef = useRef<Map<string, OngoingRequest>>(new Map());
    const latestTopicVersionRef = useRef<number>(options.topicVersion ?? 0);

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
            if (isDev) {
                const age = Date.now() - item.timestamp;
                console.log("🤖 Processing sentence:", sentence.text, `| age: ${age}ms`);
            }

            // Rate limiting: wait before making API calls
            await waitForRateLimit(75);

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

            if (isDev) console.log("🎯 Enhanced API result:", data);

            // Staleness gate: discard if topic changed since request started
            const req = ongoingRequestsRef.current.get(requestId);
            const topicChanged = req && req.topicVersion !== latestTopicVersionRef.current;
            if (topicChanged) {
                if (isDev) console.log("🗑️ Discarding stale prod due to topic change");
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Confidence gating: require confidence > 0.5
            if (typeof data?.confidence === 'number' && data.confidence <= 0.5) {
                if (isDev) console.log(`🔕 Low confidence (${data.confidence.toFixed(2)}) – skipping prod for sentence:`, sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Ensure we have valid selected prod text
            const selectedProdText = data?.selectedProd;
            if (!selectedProdText || typeof selectedProdText !== 'string' || !selectedProdText.trim()) {
                if (isDev) console.log(`⚠️ No valid selected prod text | api: ${Math.round(apiElapsed)}ms`);
                queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
                ongoingRequestsRef.current.delete(requestId);
                return;
            }

            // Create final prod with selected text
            const newProd: Prod = {
                id: `prod-${sentence.id}-${Date.now()}`,
                text: selectedProdText.trim(),
                sentenceId: sentence.id,
                timestamp: Date.now(),
            };

            if (isDev) console.log(`✅ Completed | api: ${Math.round(apiElapsed)}ms | prod:`, newProd);
            // Mark this sentence text as recently produced to avoid overlaps
            const norm = sentence.text.trim().toLowerCase();
            const nowTs = Date.now();
            try {
                // Clean old entries (>2 minutes)
                for (const [k, ts] of recentSentenceTextMapRef.current.entries()) {
                    if (nowTs - ts > 120000) recentSentenceTextMapRef.current.delete(k);
                }
                recentSentenceTextMapRef.current.set(norm, nowTs);
            } catch {}
            setProds((prev) => [...prev, newProd]);
            queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
            ongoingRequestsRef.current.delete(requestId);

        } catch (error) {
            ongoingRequestsRef.current.delete(requestId);

            // Check if it was cancelled
            if (error instanceof Error && error.name === 'AbortError') {
                if (isDev) console.log("🚫 Request was cancelled for sentence:", sentence.text);
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
                if (isDev) console.log("⏸️ Queue is already processing, skipping");
                return;
            }

            const pendingItems = queueState.items.filter(item => item.status === 'pending');
            if (pendingItems.length === 0) {
                if (isDev) console.log("📭 No pending items in queue");
                return;
            }

            if (isDev) console.log("🔄 Processing next pending item");
            queueDispatch({ type: 'SET_PROCESSING', payload: true });
            // Process only the most recent pending item
            const nextItem = pendingItems[0];
            await processSingleItem(nextItem);

            queueDispatch({ type: 'SET_PROCESSING', payload: false });
        };

        processQueue();
    }, [queueState.items, queueState.isProcessing, processSingleItem]);

    // Public API to add sentences to queue
    const recentSentenceTextMapRef = useRef<Map<string, number>>(new Map());

    const callProdAPI = useCallback((fullText: string, sentence: Sentence, opts?: { force?: boolean }) => {
        console.log("📝 callProdAPI called for sentence:", sentence.text.substring(0, 50) + "...");

        // Pre-filter sentences to skip obvious non-candidates
        if (!opts?.force && !shouldProcessSentence(sentence)) {
            console.log("⏭️ Skipping sentence:", sentence.text);
            return;
        }

        // Normalize sentence text for robust de-duplication (across regenerated IDs)
        const normalized = sentence.text.trim().toLowerCase();

        // Skip if we've produced for this text recently
        const lastProducedAt = recentSentenceTextMapRef.current.get(normalized);
        if (lastProducedAt && Date.now() - lastProducedAt < 30000) { // 30s
            console.log("🔄 Recent prod already shown for this sentence text, skipping:", sentence.text.substring(0, 50) + "...");
            return;
        }

        // Simple duplicate check: if we already have a prod for this exact sentence id, skip
        const existingProd = prods.find(p => p.sentenceId === sentence.id);

        if (existingProd) {
            console.log("🔄 Prod already exists for this sentence, skipping:", sentence.text.substring(0, 50) + "...");
            return;
        }

        // Check if we already have this normalized text in the queue (pending or processing)
        const existingInQueue = queueState.items.some(
            item => item.sentence.text.trim().toLowerCase() === normalized
        );

        if (existingInQueue) {
            console.log("🔄 Sentence already in queue, skipping:", sentence.text.substring(0, 50) + "...");
            return;
        }

        // Additional safety check: if we have any recent prod for this sentence ID, skip
        const recentProdForSentence = prods.find(p =>
            p.sentenceId === sentence.id &&
            Date.now() - p.timestamp < 5000 // Within last 5 seconds
        );

        if (recentProdForSentence) {
            console.log("🔄 Recent prod exists for this sentence ID, skipping:", sentence.text.substring(0, 50) + "...");
            return;
        }

        // Cache filtered sentence for embedding reuse
        setFilteredSentences(prev => {
            // Check if sentence already exists to avoid duplicates
            const exists = prev.some(s => s.id === sentence.id);
            if (exists) return prev;

            console.log("💾 Caching filtered sentence for embeddings:", sentence.text.substring(0, 50) + "...");
            return [...prev, sentence];
        });

        const queueItem = {
            id: `queue-${sentence.id}-${Date.now()}`,
            fullText,
            sentence,
            timestamp: Date.now(),
        };

        console.log("📝 Adding to queue:", sentence.text.substring(0, 50) + "...");
        queueDispatch({ type: 'ENQUEUE', payload: queueItem });
    }, [queueState.items, prods]);

    // Clear queue and cancel all requests
    const clearQueue = useCallback(() => {
        cancelAllRequests();
        queueDispatch({ type: 'CLEAR_QUEUE' });
    }, [cancelAllRequests]);

    // Handle topic shift - cancel relevant requests
    const handleTopicShift = useCallback(() => {
        if (isDev) console.log("🌟 Topic shift detected");
        // Do not cancel in-flight requests here.
        // We already have a staleness gate that discards results if the topic changed.
        // This avoids aborting near-complete requests that would otherwise yield good prods.
        options.onTopicShift?.();
    }, [options.onTopicShift]);

    // Clear cached sentences (for new writing sessions)
    const clearFilteredSentences = useCallback(() => {
        console.log("🗑️ Clearing cached filtered sentences");
        setFilteredSentences([]);
    }, []);

    return {
        prods,
        callProdAPI,
        clearQueue,
        handleTopicShift,
        queueState, // Expose queue state for UI feedback
        filteredSentences, // Expose cached sentences for embeddings
        clearFilteredSentences, // Allow clearing cache for new sessions
        prodMetrics: {
            durations: prodDurations,
            slowCount: prodDurations.filter((ms) => ms >= 5000).length,
            last: prodDurations.length ? prodDurations[prodDurations.length - 1] : null,
        },
    };
}
