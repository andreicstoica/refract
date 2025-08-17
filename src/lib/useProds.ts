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
  const nextAvailableAtRef = useRef<number>(0);

  // Smart sentence filtering to skip obvious non-candidates
  const shouldProcessSentence = useCallback((sentence: Sentence): boolean => {
    const text = sentence.text.trim();
    
    // Skip very short sentences
    if (text.length < 25) return false;
    
    // Skip sentences that are just punctuation or filler
    if (/^[.,!?;:\s-]+$/.test(text)) return false;
    
    // Skip sentences that are just numbers, dates, or simple greetings
    if (/^(\d+|hello|hi|hey|thanks|ok|okay)\.?$/i.test(text)) return false;
    
    // Skip sentences that are just URLs, file paths, or email addresses
    if (/^(https?:\/\/|\/[\w\/]+|[\w.-]+@[\w.-]+)/.test(text)) return false;
    
    // Skip sentences that are mostly formatting or whitespace
    if (text.replace(/[\s\n\r\t]/g, '').length < 15) return false;
    
    console.log("✅ Sentence passes filter:", text.substring(0, 50) + "...");
    return true;
  }, []);

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

      // No more abort controller - let requests complete naturally

      // Rate limiting: wait before making API calls
      await waitForRateLimit(200); // 200ms between API call sequences

      // Single smart API call: Generate candidates and select best internally
      const response = await fetch("/api/prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lastParagraph: sentence.text,
          fullText: fullText 
        }),
      });

      if (!response.ok) throw new Error("Prod API call failed");

      const data = await response.json();
      console.log("🎯 Smart API result:", data);

      // Check if AI decided to skip this sentence
      if (data?.shouldSkip === true) {
        console.log("🙅 AI decided to skip this sentence:", sentence.text);
        queueDispatch({ type: 'COMPLETE_PROCESSING', payload: id });
        return; // Skip without creating a prod
      }

      // Ensure we have valid selected prod text
      const selectedProdText = data?.selectedProd;
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
      if (timeSinceLastCall < 2000) {
        console.log("⏰ Queue processing throttled – scheduling wake-up");
        // Schedule wake-up to prevent permanent stall
        const wakeUpDelay = 2000 - timeSinceLastCall + 100; // +100ms buffer
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
    // Pre-filter sentences to skip obvious non-candidates
    if (!shouldProcessSentence(sentence)) {
      console.log("⏭️ Skipping sentence:", sentence.text);
      return;
    }

    const queueItem = {
      id: `queue-${sentence.id}-${Date.now()}`,
      fullText,
      sentence,
      timestamp: Date.now(),
    };

    console.log("📝 Adding to queue:", sentence.text);
    queueDispatch({ type: 'ENQUEUE', payload: queueItem });
  }, [shouldProcessSentence]);

  // Clear queue  
  const clearQueue = useCallback(() => {
    queueDispatch({ type: 'CLEAR_QUEUE' });
  }, []);


  return {
    prods,
    callProdAPI,
    clearQueue,
    queueState, // Expose queue state for UI feedback
  };
}