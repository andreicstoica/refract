"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightLayer } from "@/components/highlight/HighlightLayer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/helpers";
import type { Sentence, SentencePosition } from "@/types/sentence";
import { AnimatePresence, motion } from "framer-motion";
import { useHeaderRevealAnimation } from "@/features/ui/hooks/useHeaderRevealAnimation";
import { ProdsProvider } from "@/features/prods/context/ProdsProvider";
import { useThemeAnalysis } from "@/features/themes/hooks/useThemeAnalysis";

export default function WritePage() {
  // Timer + intro state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);

  // Writing state
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);

  const {
    themes,
    selectedThemeIds,
    isGenerating,
    hasThemes,
    highlightRanges,
    allHighlightableRanges,
    toggleTheme,
    requestAnalysis,
    rerunAnalysis,
  } = useThemeAnalysis({
    sentences: currentSentences,
    text: currentText,
  });

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
      if (hasThemes || isGenerating || currentSentences.length === 0) return;

      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("🧠 analysis: started");
        }

        await requestAnalysis();

        if (process.env.NODE_ENV !== "production") {
          console.log("✅ analysis: completed");
        }
      } catch (err) {
        console.error("❌ analysis failed", err);
      }
    },
    [
      hasThemes,
      isGenerating,
      currentSentences.length,
      requestAnalysis,
    ]
  );

  const handleTextUpdate = (
    text: string,
    sentences: Sentence[],
    positions: SentencePosition[]
  ) => {
    setCurrentText(text);
    setCurrentSentences(sentences);
  };

  // Explicit re-run of embeddings on demand
  const handleRerunEmbeddings = useCallback(async () => {
    if (isGenerating) return;
    try {
      await rerunAnalysis();
    } catch (err) {
      console.error("❌ re-run embeddings failed", err);
    }
  }, [isGenerating, rerunAnalysis]);

  // Header reveal animation when themes first appear
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
        <ProdsProvider>
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
                  activeRanges={highlightRanges}
                  referenceRanges={allHighlightableRanges}
                  textareaRef={textareaRefObject}
                  extraTopPaddingPx={0}
                />
              </div>
            ) : null}
          </TextInput>
        </ProdsProvider>
      </div>
    </div>
  );
}
