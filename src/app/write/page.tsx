"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/TextInput";
import { AppNav } from "@/components/AppNav";
import { WritingTimer } from "@/components/WritingTimer";
import { IntroModal } from "@/components/IntroModal";
import { useGenerateEmbeddings } from "@/hooks/useGenerateEmbeddings";
import { storage } from "@/services/storage";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";

export default function WritePage() {
  const router = useRouter();
  const { generate: generateEmbeddings, isGenerating } =
    useGenerateEmbeddings();

  // Simplified state management
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);
  const [currentPositions, setCurrentPositions] = useState<SentencePosition[]>(
    []
  );

  // Simple navigation state
  const analyzeDisabled = !analyzeEnabled || isGenerating;

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

  const handleTimerStart = (minutes: number) => {
    setTimerMinutes(minutes);
    setShowTimerSetup(false);
    setTimerStarted(true);

    // Enable analyze tab after 20 seconds
    setTimeout(() => {
      setAnalyzeEnabled(true);
    }, 20000);
  };

  const handleTimerComplete = () => {
    setTimerCompleted(true);
    setAnalyzeEnabled(true); // Ensure analyze is enabled when timer completes
  };

  const handleTabChange = useCallback(
    async (tab: "write" | "reflect") => {
      if (tab === "reflect" && analyzeEnabled) {
        try {
          // Start analysis and navigate immediately
          // Clear any stale themes/text so the reflect page doesn't pick up old data
          storage.clear();
          localStorage.setItem("refract-analysis", "running");

          // Fire embeddings generation - it handles storage internally
          generateEmbeddings(currentSentences, currentText);

          // Navigate immediately
          router.push("/themes");
        } catch (error) {
          console.error("❌ Failed to start analysis:", error);
        }
      }
    },
    [analyzeEnabled, currentSentences, currentText, router, generateEmbeddings]
  );

  // Prevent page scrolling when on write page
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;

    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      {/* App Navigation */}
      <AppNav
        active="write"
        onTabChange={handleTabChange}
        analyzeDisabled={analyzeDisabled}
        isProcessing={isGenerating}
      />

      {/* Timer Setup Modal */}
      <IntroModal isOpen={showTimerSetup} onStart={handleTimerStart} />

      {/* Timer Display */}
      {!showTimerSetup && (
        <div className="flex justify-center pt-4">
          <WritingTimer
            initialMinutes={timerMinutes}
            onTimerComplete={handleTimerComplete}
          />
        </div>
      )}

      {/* Text Input */}
      <div className="flex-1 min-h-0">
        <TextInput
          onTextChange={handleTextChange}
          onTextUpdate={handleTextUpdate}
          placeholder="What's on your mind?"
        />
      </div>
    </div>
  );
}
