"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/TextInput";
import { WritingNav } from "@/components/WritingNav";
import type { Sentence } from "@/lib/sentenceUtils";
import type { SentencePosition } from "@/lib/positionUtils";

export default function WritePage() {
  const router = useRouter();
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);
  const [currentPositions, setCurrentPositions] = useState<SentencePosition[]>(
    []
  );

  const handleTextChange = (text: string) => {
    setCurrentText(text);
  };

  const handleTextUpdate = (
    text: string,
    sentences: Sentence[],
    positions: SentencePosition[]
  ) => {
    setCurrentText(text);
    setCurrentSentences(sentences);
    setCurrentPositions(positions);
  };

  const handleDone = useCallback(async () => {
    if (currentSentences.length === 0) {
      console.log("⚠️ No sentences available for embeddings");
      return;
    }

    setIsGeneratingEmbeddings(true);

    try {
      console.log(
        `🎯 Generating embeddings for ${currentSentences.length} sentences`
      );

      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences: currentSentences,
          fullText: currentText,
        }),
      });

      if (!response.ok) throw new Error("Embeddings API call failed");

      const data = await response.json();
      console.log("✨ Embeddings result:", data);

      // Save to localStorage for themes page
      localStorage.setItem("refract-themes", JSON.stringify(data.themes || []));
      localStorage.setItem("refract-text", currentText);

      // Navigate to themes page
      router.push("/themes");
    } catch (error) {
      console.error("❌ Embeddings generation failed:", error);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  }, [currentSentences, currentText, router]);

  return (
    <div className="relative h-dvh bg-background text-foreground overflow-hidden">
      <WritingNav onDone={handleDone} isProcessing={isGeneratingEmbeddings} />
      <TextInput
        onTextChange={handleTextChange}
        onTextUpdate={handleTextUpdate}
        placeholder="What's on your mind?"
      />
    </div>
  );
}
