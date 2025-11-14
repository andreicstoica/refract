"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { useEmbeddings } from "@/features/ai/EmbeddingsProvider";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightLayer } from "@/components/highlight/HighlightLayer";
import { rangesFromThemes } from "@/lib/highlight";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/helpers";
import type { Sentence, SentencePosition } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { AnimatePresence, motion } from "framer-motion";
import { useHeaderRevealAnimation } from "@/features/ui/hooks/useHeaderRevealAnimation";

export default function WritePage() {
  const { generateThemes: generate, isGenerating } = useEmbeddings();

  // Timer + intro state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);

  // Writing state
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);

  // Theme state - simple, direct
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  // Overlay scroll sync - direct DOM manipulation to avoid React re-renders
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(
    null
  );
  const textareaRefObject = useMemo(
    () => ({ current: textareaEl } as React.RefObject<HTMLTextAreaElement>),
    [textareaEl]
  );
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const reloadButtonRef = useRef<HTMLButtonElement | null>(null);
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

  // Explicit re-run of embeddings on demand
  const handleRerunEmbeddings = useCallback(async () => {
    if (isGenerating) return;
    try {
      const result = await generate(currentSentences, currentText);
      if (result && result.length) {
        setThemes(result);
      }
    } catch (err) {
      console.error("❌ re-run embeddings failed", err);
    }
  }, [isGenerating, generate, currentSentences, currentText]);

  // Header reveal animation when themes first appear
  const hasThemes = Boolean(themes && themes.length > 0);
  useHeaderRevealAnimation(hasThemes, chipsRef, reloadButtonRef);

  // Observe textarea scroll for overlay sync
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    setTextareaEl(el);
  }, []);

  // Note: overlay components (ChipOverlay, HighlightLayer) handle their own
  // RAF-coalesced scroll sync. Avoid duplicating here to prevent jank/lag.

  // hasThemes computed above

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background text-foreground">
      {/* Timer Setup Modal */}
      <IntroModal isOpen={showTimerSetup} onStart={handleTimerStart} />

      {/* Header with Timer + Theme Controls */}
      <AnimatePresence>
        {!showTimerSetup && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
            }}
            className="overflow-hidden"
          >
            <div
              data-header-container
              className={`flex items-center pt-4 w-full mx-auto ${
                hasThemes
                  ? "justify-between max-w-2xl px-8"
                  : "justify-center max-w-6xl px-8"
              }`}
            >
              <div data-timer-container className="flex items-center">
                <WritingTimer
                  initialMinutes={timerMinutes}
                  onTimerComplete={handleTimerComplete}
                  onThreshold={handlePreFinish}
                  thresholdSeconds={20}
                />
                {hasThemes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        ref={reloadButtonRef}
                        variant="ghost"
                        className={cn(
                          "ml-3 h-10 px-3",
                          // Match timer's neutral styling
                          "bg-muted/50 backdrop-blur-sm border border-border/50 rounded-md"
                        )}
                        onClick={handleRerunEmbeddings}
                        disabled={isGenerating || currentSentences.length === 0}
                        aria-label="Reload themes"
                      >
                        <RefreshCw
                          className={cn(
                            "w-4 h-4",
                            isGenerating && "animate-spin"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reload themes</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {hasThemes && (
                <div
                  ref={chipsRef}
                  className="flex-1 ml-3 min-w-0 flex items-center"
                >
                  <div className="overflow-x-auto flex-1">
                    <ThemeToggleButtons
                      themes={themes!}
                      selectedThemeIds={selectedThemeIds}
                      onThemeToggle={toggleTheme}
                      noXPad
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Writing Surface with highlight layer */}
      <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full overflow-hidden">
        <TextInput
          onTextUpdate={handleTextUpdate}
          onTextareaRef={handleTextareaRef}
          prodsEnabled={!showTimerSetup}
        >
          {/* Highlight paint layer: fades in when themes ready */}
          {hasThemes ? (
            <div className="transition-opacity duration-300 ease-out opacity-100">
              <HighlightLayer
                ref={highlightLayerRef}
                text={currentText}
                currentRanges={highlightRanges}
                allRanges={allHighlightableRanges}
                textareaRef={textareaRefObject}
                extraTopPaddingPx={0}
              />
            </div>
          ) : null}
        </TextInput>
      </div>
    </div>
  );
}
