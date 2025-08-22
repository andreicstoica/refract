"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { useGenerateEmbeddings } from "@/hooks/useGenerateEmbeddings";
import { storage } from "@/services/storage";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightLayer } from "@/components/highlight/HighlightLayer";
import { useThemeHighlightData } from "@/hooks/useThemeHighlightData";
import type { Sentence, SentencePosition } from "@/types/sentence";

export default function WritingCombinedPage() {
  const { generate, isGenerating } = useGenerateEmbeddings();

  // Timer + intro state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);

  // Writing state
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);
  const [currentPositions, setCurrentPositions] = useState<SentencePosition[]>(
    []
  );

  // Analysis state
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const [localThemes, setLocalThemes] = useState<any[] | null>(null);

  // Overlay scroll sync
  const [scrollTop, setScrollTop] = useState(0);
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null);

  const handleTimerStart = (minutes: number) => {
    setTimerMinutes(minutes);
    setShowTimerSetup(false);
  };

  const handleTimerComplete = () => {
    // Nothing special here; analysis should already be running or completed
  };

  const handlePreFinish = useCallback(
    async (_secondsLeft: number) => {
      if (hasStartedAnalysis || isGenerating) return;
      setHasStartedAnalysis(true);

      try {
        // Clear stale data and mark analysis in progress
        storage.clear();
        localStorage.setItem("refract-analysis", "running");
        if (process.env.NODE_ENV !== "production") {
          console.log("🧠 analysis: started");
        }

        // Kick off embeddings; when done, it persists themes/text/sentences
        const themes = await generate(currentSentences, currentText);
        if (themes && themes.length) setLocalThemes(themes);

        if (process.env.NODE_ENV !== "production") {
          console.log("✅ analysis: completed");
        }
      } catch (err) {
        console.error("❌ analysis failed", err);
      }
    },
    [currentSentences, currentText, generate, hasStartedAnalysis, isGenerating]
  );

  const handleTextUpdate = (
    text: string,
    sentences: Sentence[],
    positions: SentencePosition[]
  ) => {
    setCurrentText(text);
    setCurrentSentences(sentences);
    setCurrentPositions(positions);
  };

  // Theme data for overlay; prefer locally returned themes if present, else poll storage
  const { themes, fullText, selectedThemeIds, highlightRanges, allHighlightableRanges, toggleTheme } =
    useThemeHighlightData({
      propThemes: localThemes ?? undefined,
      propFullText: currentText,
      propSentences: currentSentences,
      disableStorageFallback: true,
    });

  // Lock body scroll, match write page behavior
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

  // Observe textarea scroll for overlay sync
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    setTextareaEl(el);
  }, []);

  useEffect(() => {
    if (!textareaEl) return;
    const onScroll = () => setScrollTop(textareaEl.scrollTop);
    // initialize sync
    setScrollTop(textareaEl.scrollTop);
    textareaEl.addEventListener("scroll", onScroll);
    return () => {
      textareaEl.removeEventListener("scroll", onScroll);
    };
  }, [textareaEl]);

  // Whether we have themes to reveal
  const hasThemes = Boolean(themes && themes.length > 0);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background text-foreground">
      {/* Timer Setup Modal */}
      <IntroModal isOpen={showTimerSetup} onStart={handleTimerStart} />

      {/* Floating Timer */}
      {!showTimerSetup && (
        <div className="flex justify-center pt-4">
          <WritingTimer
            initialMinutes={timerMinutes}
            onTimerComplete={handleTimerComplete}
            onThreshold={handlePreFinish}
            thresholdSeconds={20}
          />
        </div>
      )}

      {/* Writing Surface with inline themes overlay */}
      <div className="flex-1 min-h-0">
        <TextInput onTextUpdate={handleTextUpdate} onTextareaRef={handleTextareaRef}>
          {/* Theme buttons overlay: fade/slide in when themes available */}
          {hasThemes ? (
            <div className="absolute left-0 right-0 -top-2 z-20 flex justify-center pointer-events-none">
              <div className="w-full max-w-2xl px-4 pointer-events-auto">
                <div className="transition-all duration-300 ease-out opacity-100 translate-y-0 motion-reduce:translate-y-0">
                  <ThemeToggleButtons
                    themes={themes!}
                    selectedThemeIds={selectedThemeIds}
                    onThemeToggle={toggleTheme}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Highlight paint layer: fades in when themes ready */}
          {hasThemes ? (
            <div className="transition-opacity duration-300 ease-out opacity-100">
              <HighlightLayer
                text={fullText || currentText}
                currentRanges={highlightRanges}
                allRanges={allHighlightableRanges}
                scrollTop={scrollTop}
              />
            </div>
          ) : null}
        </TextInput>
      </div>
    </div>
  );
}
