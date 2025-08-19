"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/TextInput";
import { WritingNav } from "@/components/WritingNav";
import { useGenerateEmbeddings } from "@/hooks/useGenerateEmbeddings";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";

export default function WritePage() {
  const router = useRouter();
  const { generate: generateEmbeddings, isGenerating } =
    useGenerateEmbeddings();
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
    try {
      console.log("🔄 Starting embeddings generation...");
      const themes = await generateEmbeddings(currentSentences, currentText);
      console.log("✅ Embeddings generation complete, themes:", themes);

      // Only navigate after AI processing is complete
      router.push("/themes");
    } catch (error) {
      console.error("❌ Embeddings generation failed:", error);
    }
  }, [currentSentences, currentText, router, generateEmbeddings]);

  return (
    <div className="relative h-dvh bg-background text-foreground overflow-hidden">
      <WritingNav onDone={handleDone} isProcessing={isGenerating} />
      <TextInput
        onTextChange={handleTextChange}
        onTextUpdate={handleTextUpdate}
        placeholder="What's on your mind?"
      />
    </div>
  );
}
