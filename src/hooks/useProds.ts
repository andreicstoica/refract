import { useState, useRef, useCallback, useReducer, useEffect } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueItem, QueueState, QueueAction } from "@/types/queue";
import { generateProd } from "@/services/prodClient";
import { shouldProcessSentence } from "@/utils/shouldProcessSentence";

const isDev = process.env.NODE_ENV !== "production";

function queueReducer(state: QueueState, action: QueueAction): QueueState {
    switch (action.type) {
        case 'ENQUEUE':
            return {
                ...state,
                items: [...state.items, { ...action.payload, status: 'pending' }]
            };
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

export function useProds() {
    const [prods, setProds] = useState<Prod[]>([]);
    const [queueState, queueDispatch] = useReducer(queueReducer, {
        items: [],
        isProcessing: false
    });
    // Cache for filtered sentences to reuse for embeddings
    const [filteredSentences, setFilteredSentences] = useState<Sentence[]>([]);
    const lastApiCallRef = useRef<number>(0);
    const nextAvailableAtRef = useRef<number>(0);

    // Helper to wait for rate limit window
    const waitForRateLimit = useCallback(async (delayMs: number) => {
        const now = Date.now();
        const waitTime = Math.max(0, nextAvailableAtRef.current - now);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        nextAvailableAtRef.current = Date.now() + delayMs;
    }, []);

    // Process a single queue item
    const processSingleItem = useCallback(async (item: QueueItem) => {
        const { fullText, sentence, id } = item;

        try {
            queueDispatch({ type: 'START_PROCESSING', payload: id });
            if (isDev) console.log("🤖 Processing sentence:", sentence.text);

            // Rate limiting: wait before making API calls
            await waitForRateLimit(150);

            // Single smart API call: Generate and select best internally
            const data = await generateProd({
                lastParagraph: sentence.text,
                fullText: fullText
            });

            if (isDev) console.log("🎯 Smart API result:", data);

            // Check if AI decided to skip this sentence
            if (data?.shouldSkip === true) {
                if (isDev) console.log("🙅 AI decided to skip this sentence:", sentence.text);
                queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
                return; // Skip without creating a prod
            }

            // Ensure we have valid selected prod text
            const selectedProdText = data?.selectedProd;
            if (!selectedProdText || typeof selectedProdText !== 'string' || !selectedProdText.trim()) {
                if (isDev) console.log("⚠️ No valid selected prod text");
                queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
                return;
            }

            // Create final prod with selected text
            const newProd: Prod = {
                id: `prod-${sentence.id}-${Date.now()}`,
                text: selectedProdText.trim(),
                sentenceId: sentence.id,
                timestamp: Date.now(),
            };

            if (isDev) console.log("💡 Final selected prod:", newProd);
            setProds((prev) => [...prev, newProd]);
            queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });

        } catch (error) {
            console.error("❌ Prod pipeline error:", error);
            queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
        }
    }, [waitForRateLimit]);

    // Process queue sequentially
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

            if (isDev) console.log("🔄 Processing queue with", pendingItems.length, "pending items");

            // Check throttling for the entire queue processing
            const now = Date.now();
            const timeSinceLastCall = now - lastApiCallRef.current;
            if (timeSinceLastCall < 500) {
                if (isDev) console.log("⏰ Queue processing throttled – scheduling wake-up");
                // Schedule wake-up to prevent permanent stall
                const wakeUpDelay = 500 - timeSinceLastCall + 100; // +100ms buffer
                setTimeout(() => {
                    queueDispatch({ type: 'SET_PROCESSING', payload: false }); // Trigger re-run
                }, wakeUpDelay);
                return;
            }

            queueDispatch({ type: 'SET_PROCESSING', payload: true });
            lastApiCallRef.current = now;

            // Process items in parallel batches (2-3 at a time) for better performance
            const batchSize = 2;
            for (let i = 0; i < pendingItems.length; i += batchSize) {
                const batch = pendingItems.slice(i, i + batchSize);
                if (isDev) console.log("📦 Processing batch", Math.floor(i / batchSize) + 1, "with", batch.length, "items");
                const promises = batch.map(item => processSingleItem(item));
                await Promise.all(promises);

                // Small delay between batches to avoid overwhelming the server
                if (i + batchSize < pendingItems.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            queueDispatch({ type: 'SET_PROCESSING', payload: false });
        };

        processQueue();
    }, [queueState.items, queueState.isProcessing, processSingleItem]);

    // Public API to add sentences to queue
    const callProdAPI = useCallback((fullText: string, sentence: Sentence) => {
        console.log("📝 callProdAPI called for sentence:", sentence.text.substring(0, 50) + "...");

        // Pre-filter sentences to skip obvious non-candidates
        if (!shouldProcessSentence(sentence)) {
            console.log("⏭️ Skipping sentence:", sentence.text);
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
    }, []);

    // Clear queue  
    const clearQueue = useCallback(() => {
        queueDispatch({ type: 'CLEAR_QUEUE' });
    }, []);

    // Clear cached sentences (for new writing sessions)
    const clearFilteredSentences = useCallback(() => {
        console.log("🗑️ Clearing cached filtered sentences");
        setFilteredSentences([]);
    }, []);

    return {
        prods,
        callProdAPI,
        clearQueue,
        queueState, // Expose queue state for UI feedback
        filteredSentences, // Expose cached sentences for embeddings
        clearFilteredSentences, // Allow clearing cache for new sessions
    };
}
