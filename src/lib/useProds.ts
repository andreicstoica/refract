import { useState, useRef, useCallback, useReducer, useEffect } from "react";
import type { Sentence } from "./sentenceUtils";

export interface Prod {
  id: string;
  text: string;
  sentenceId: string;
  timestamp: number;
}

interface QueueItem {
  id: string;
  fullText: string;
  sentence: Sentence;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface QueueState {
  items: QueueItem[];
  isProcessing: boolean;
}

type QueueAction = 
  | { type: 'ENQUEUE'; payload: Omit<QueueItem, 'status'> }
  | { type: 'START_PROCESSING'; payload: string }
  | { type: 'COMPLETE_PROCESSING'; payload: string }
  | { type: 'FAIL_PROCESSING'; payload: string }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'CLEAR_QUEUE' };

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
  const lastApiCallRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
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
      console.log("🤖 Processing sentence:", sentence.text);

      // Setup AbortController for this item
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      // Rate limiting: wait before making API calls
      await waitForRateLimit(700); // 700ms between API call sequences

      // Step 1: Generate multiple prod candidates
      const prodResponse = await fetch("/api/prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastParagraph: sentence.text }),
        signal,
      });

      if (!prodResponse.ok) throw new Error("Prod API call failed");

      const prodData = await prodResponse.json();
      console.log("📡 Prod candidates:", prodData);
      
      // Defensive type checking
      const candidateProds = Array.isArray(prodData?.prods) ? prodData.prods.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0) : [];
      
      if (candidateProds.length === 0) {
        console.log("⚠️ No valid candidates generated");
        queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
        return;
      }

      // Step 2: Use selection API to pick the best candidate
      console.log("🎯 Selecting best prod from candidates");
      const selectionResponse = await fetch("/api/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          sentence: sentence.text,
          prods: candidateProds,
          sentenceId: sentence.id,
        }),
        signal,
      });

      let selectedProdText: string;
      
      if (!selectionResponse.ok) {
        console.log("⚠️ Selection API failed, using first candidate");
        selectedProdText = candidateProds[0];
      } else {
        const selectionData = await selectionResponse.json();
        console.log("🎯 Selection result:", selectionData);
        // Defensive checking for selection result
        selectedProdText = (typeof selectionData?.selectedProd === 'string' && selectionData.selectedProd.trim()) 
          ? selectionData.selectedProd 
          : candidateProds[0];
      }

      // Ensure we have valid text before creating prod
      if (!selectedProdText || typeof selectedProdText !== 'string' || !selectedProdText.trim()) {
        console.log("⚠️ No valid selected prod text");
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

      console.log("💡 Final selected prod:", newProd);
      setProds((prev) => [...prev, newProd]);
      queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
      
    } catch (error) {
      // Handle AbortError separately (don't log as error)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("🚫 Request aborted:", sentence.text);
        return; // Don't mark as failed, just cancelled
      }
      console.error("❌ Prod pipeline error:", error);
      queueDispatch({ type: 'FAIL_PROCESSING', payload: id });
    }
  }, [waitForRateLimit]);

  // Process queue sequentially
  useEffect(() => {
    const processQueue = async () => {
      if (queueState.isProcessing) return;
      
      const pendingItems = queueState.items.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) return;

      // Check throttling for the entire queue processing
      const now = Date.now();
      const timeSinceLastCall = now - lastApiCallRef.current;
      if (timeSinceLastCall < 7000) {
        console.log("⏰ Queue processing throttled – scheduling wake-up");
        // Schedule wake-up to prevent permanent stall
        const wakeUpDelay = 7000 - timeSinceLastCall + 100; // +100ms buffer
        setTimeout(() => {
          queueDispatch({ type: 'SET_PROCESSING', payload: false }); // Trigger re-run
        }, wakeUpDelay);
        return;
      }

      queueDispatch({ type: 'SET_PROCESSING', payload: true });
      lastApiCallRef.current = now;

      // Process items in order (first in, first out)
      for (const item of pendingItems) {
        await processSingleItem(item);
      }

      queueDispatch({ type: 'SET_PROCESSING', payload: false });
    };

    processQueue();
  }, [queueState.items, queueState.isProcessing, processSingleItem]);

  // Public API to add sentences to queue
  const callProdAPI = useCallback((fullText: string, sentence: Sentence) => {
    const queueItem = {
      id: `queue-${sentence.id}-${Date.now()}`,
      fullText,
      sentence,
      timestamp: Date.now(),
    };

    console.log("📝 Adding to queue:", sentence.text);
    queueDispatch({ type: 'ENQUEUE', payload: queueItem });
  }, []);

  // Clear queue and abort ongoing requests
  const clearQueue = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queueDispatch({ type: 'CLEAR_QUEUE' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    prods,
    callProdAPI,
    clearQueue,
    queueState, // Expose queue state for UI feedback
  };
}