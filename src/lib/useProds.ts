import { useState, useRef, useCallback } from "react";
import type { Sentence } from "./sentenceUtils";

export interface Prod {
  id: string;
  text: string;
  sentenceId: string;
  timestamp: number;
}

export function useProds() {
  const [prods, setProds] = useState<Prod[]>([]);
  const lastApiCallRef = useRef<number>(0);

  const callProdAPI = useCallback(async (lastSentence: Sentence) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallRef.current;

    // Throttle: minimum 7 seconds between calls
    if (timeSinceLastCall < 7000) {
      console.log("⏰ API call throttled – waiting for cooldown");
      return;
    }

    try {
      console.log("🤖 Calling prod API for sentence:", lastSentence.text);
      lastApiCallRef.current = now;

      const response = await fetch("/api/prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastParagraph: lastSentence.text }),
      });

      if (!response.ok) throw new Error("API call failed");

      const responseData = await response.json();
      console.log("📡 Raw API response:", responseData);
      
      // Extract prods from structured response
      const prodTexts = responseData.prods || [];
      
      const newProds: Prod[] = prodTexts.map((prodText: string, index: number) => ({
        id: `prod-${Date.now()}-${index}`,
        text: prodText.trim(),
        sentenceId: lastSentence.id,
        timestamp: now,
      }));

      console.log("💡 Structured prods:", newProds);
      if (newProds.length > 0) {
        setProds((prev) => [...prev, ...newProds]);
      } else {
        console.log("⚠️ No prods found in response");
      }
    } catch (error) {
      console.error("❌ Prod API error:", error);
    }
  }, []);

  return {
    prods,
    callProdAPI,
  };
}