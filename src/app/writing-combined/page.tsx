"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { useGenerateEmbeddings } from "@/hooks/useGenerateEmbeddings";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightLayer } from "@/components/highlight/HighlightLayer";
import { rangesFromThemes } from "@/lib/highlight";
import type { Sentence, SentencePosition } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { gsap } from "gsap";

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

  // Theme state - simple, direct
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  // Overlay scroll sync
  const [scrollTop, setScrollTop] = useState(0);
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const prevHasThemesRef = useRef(false);

  const handleTimerStart = (minutes: number) => {
    setTimerMinutes(minutes);
    setShowTimerSetup(false);
  };

  const handleTimerComplete = () => {
    // Nothing special here; analysis should already be running or completed
  };

  const handlePreFinish = useCallback(
    async (_secondsLeft: number) => {
      if (themes || isGenerating) return;

      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("🧠 analysis: started");
        }

        const result = await generate(currentSentences, currentText);
        if (result && result.length) {
          setThemes(result);
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("✅ analysis: completed");
        }
      } catch (err) {
        console.error("❌ analysis failed", err);
      }
    },
    [currentSentences, currentText, generate, themes, isGenerating]
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

  // Build sentence lookup map
  const sentenceMap = useMemo(() => {
    const map = new Map<string, Sentence>();
    for (const sentence of currentSentences) {
      map.set(sentence.id, sentence);
    }
    return map;
  }, [currentSentences]);

  // All possible ranges (stable segmentation)
  const allHighlightableRanges = useMemo(
    () => rangesFromThemes(themes, sentenceMap),
    [themes, sentenceMap]
  );

  // Currently active ranges (selected themes only)
  const highlightRanges = useMemo(() => {
    if (!themes || selectedThemeIds.length === 0) return [];
    return rangesFromThemes(themes, sentenceMap, new Set(selectedThemeIds));
  }, [themes, selectedThemeIds, sentenceMap]);

  const toggleTheme = (themeId: string) => {
    setSelectedThemeIds((prev) =>
      prev.includes(themeId)
        ? prev.filter((id) => id !== themeId)
        : [...prev, themeId]
    );
  };

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

  // Animate chip reveal and make visual room when themes first appear
  useEffect(() => {
    if (!hasThemes || prevHasThemesRef.current) return;
    prevHasThemesRef.current = true;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    if (chipsRef.current) {
      gsap.fromTo(
        chipsRef.current,
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
    }
  }, [hasThemes]);

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
        <TextInput
          onTextUpdate={handleTextUpdate}
          onTextareaRef={handleTextareaRef}
          prodsEnabled={!showTimerSetup}
          extraTopPaddingPx={hasThemes ? 40 : 0}
        >
          {/* Theme buttons overlay: fade/slide in when themes available */}
          {hasThemes ? (
            <div ref={chipsRef} className="absolute left-0 right-0 top-0 z-20 flex justify-center pointer-events-none">
              <div className="w-full max-w-2xl px-4 pointer-events-auto">
                <div className="transition-all duration-300 ease-out opacity-100 translate-y-0 motion-reduce:translate-y-0">
                  <ThemeToggleButtons
                    themes={themes!}
                    selectedThemeIds={selectedThemeIds}
                    onThemeToggle={toggleTheme}
                    noXPad
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Highlight paint layer: fades in when themes ready */}
          {hasThemes ? (
            <div className="transition-opacity duration-300 ease-out opacity-100">
              <HighlightLayer
                text={currentText}
                currentRanges={highlightRanges}
                allRanges={allHighlightableRanges}
                scrollTop={scrollTop}
                extraTopPaddingPx={hasThemes ? 40 : 0}
              />
            </div>
          ) : null}
        </TextInput>
      </div>
    </div>
  );
}
