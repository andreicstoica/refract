import { useState, useEffect, useRef, useCallback } from 'react';

interface Prod {
  id: string;
  text: string;
  timestamp: number;
  sourceText: string;
}

interface UseAIProdsReturn {
  prods: Prod[];
  isLoading: boolean;
  error: string | null;
}

export function useAIProds(text: string): UseAIProdsReturn {
  const [prods, setProds] = useState<Prod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastApiCallRef = useRef<number>(0);
  const lastProcessedTextRef = useRef<string>('');

  // Extract last 1-3 sentences or ~500-1000 chars for context
  const extractRelevantText = useCallback((fullText: string): string => {
    if (!fullText.trim()) return '';

    // First try sentence-based extraction
    const sentences = fullText.split(/[.!?;:]\s+/).filter(s => s.trim());
    if (sentences.length > 0) {
      const lastSentences = sentences.slice(-3).join('. ').trim();
      if (lastSentences.length > 50) {
        return lastSentences;
      }
    }

    // Fallback to character-based extraction
    const trimmed = fullText.trim();
    if (trimmed.length <= 1000) return trimmed;

    return trimmed.slice(-1000);
  }, []);

  // Check if text ends with punctuation that should trigger analysis
  const endsWithTriggerPunctuation = useCallback((text: string): boolean => {
    return /[.!?;:]\s*$/.test(text.trim());
  }, []);

  // Check if enough time has passed since last API call (7 second throttle)
  const canMakeApiCall = useCallback((): boolean => {
    const now = Date.now();
    return now - lastApiCallRef.current >= 15000; // 15 seconds instead of 7
  }, []);

  // Make API call to generate prods
  const generateProds = useCallback(async (sourceText: string): Promise<void> => {
    if (!canMakeApiCall()) {
      console.log('🚫 API call throttled - waiting for 7s cooldown');
      return;
    }

    setIsLoading(true);
    setError(null);
    lastApiCallRef.current = Date.now();

    console.log('🧠 Sending to AI for analysis:', sourceText);

    try {
      const response = await fetch('/api/prod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lastParagraph: sourceText }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      const prodLines = data.prods;

      console.log('💭 AI Response:', prodLines);

      // Create prod objects
      const newProds: Prod[] = prodLines.map((prodText: string, index: number) => ({
        id: `${Date.now()}-${index}`,
        text: prodText,
        timestamp: Date.now(),
        sourceText: sourceText,
      }));

      setProds(prev => {
        const existingTexts = new Set(prev.map(p => p.text.toLowerCase().trim()));
        const uniqueNewProds = newProds.filter(prod =>
          !existingTexts.has(prod.text.toLowerCase().trim())
        );
        return [...prev, ...uniqueNewProds];
      });

      console.log('✨ Generated prods:', newProds.map(p => p.text));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Error generating prods:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [canMakeApiCall]);

  // Main effect that watches for text changes and triggers analysis
  useEffect(() => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't process if text is empty or hasn't changed meaningfully
    if (!text.trim() || text === lastProcessedTextRef.current) {
      return;
    }

    const relevantText = extractRelevantText(text);

    // Immediate trigger for punctuation (but with higher minimum length)
    if (endsWithTriggerPunctuation(text) && relevantText.length > 100) { // 100 chars instead of 20
      console.log('⚡ Punctuation trigger detected');
      generateProds(relevantText);
      lastProcessedTextRef.current = text;
      return;
    }

    // Debounced trigger for idle typing (8 seconds instead of 3)
    if (relevantText.length > 150) { // 150 chars instead of 50
      console.log('⏱️  Setting 8s debounce timer');
      debounceTimerRef.current = setTimeout(() => {
        console.log('⏰ Idle trigger activated (8s pause)');
        generateProds(relevantText);
        lastProcessedTextRef.current = text;
      }, 8000); // 8 seconds instead of 3
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [text, extractRelevantText, endsWithTriggerPunctuation, generateProds]);

  return {
    prods,
    isLoading,
    error,
  };
}