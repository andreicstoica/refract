"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightOverlay } from "@/components/highlight/HighlightOverlay";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, Clipboard } from "lucide-react";
import { cn } from "@/lib/helpers";
import type { Sentence, SentencePosition } from "@/types/sentence";
import { AnimatePresence, motion } from "framer-motion";
import { useHeaderRevealAnimation } from "@/features/ui/hooks/useHeaderRevealAnimation";
import { DEMO_TEXT } from "@/lib/demoMode";
import { ProdsProvider } from "@/features/prods/context/ProdsProvider";
import { useThemeAnalysis } from "@/features/themes/hooks/useThemeAnalysis";
import { debug } from "@/lib/debug";

export default function DemoPage() {
  // Timer + intro state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [clipboardStatus, setClipboardStatus] = useState<
    "loading" | "error" | null
  >(null);

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

  // Create textarea ref for HighlightOverlay
  const textareaRefObject = useRef<HTMLTextAreaElement>(null as any);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const reloadButtonRef = useRef<HTMLButtonElement | null>(null);
  // Pre-load demo content to clipboard
  useEffect(() => {
    const loadClipboard = async () => {
      try {
        setClipboardStatus("loading");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // Try to write to clipboard immediately
          await navigator.clipboard.writeText(DEMO_TEXT);
          setClipboardStatus(null); // Hide status silently on success
        } else {
          setClipboardStatus("error");
        }
      } catch (error) {
        // If it fails, try again after a short delay (common during page load)
        setTimeout(async () => {
          try {
            await navigator.clipboard.writeText(DEMO_TEXT);
            setClipboardStatus(null);
          } catch (retryError) {
            debug.error(
              "Failed to load demo content to clipboard:",
              retryError
            );
            setClipboardStatus("error");
          }
        }, 500);
      }
    };

    loadClipboard();

  }, []);

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
        debug.dev("🧠 analysis: started");

        await requestAnalysis();

        debug.dev("✅ analysis: completed");
      } catch (err) {
        debug.error("❌ analysis failed", err);
      }
    },
    [hasThemes, isGenerating, currentSentences.length, requestAnalysis]
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
      debug.error("❌ re-run embeddings failed", err);
    }
  }, [isGenerating, rerunAnalysis]);

  // Header reveal animation when themes first appear
  useHeaderRevealAnimation(hasThemes, chipsRef, reloadButtonRef);

  // Handle textarea ref for HighlightOverlay
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRefObject.current = el!; // Non-null assertion since TextInput always provides valid element
  }, []);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background text-foreground">
      {/* Demo Clipboard Status */}
      {clipboardStatus && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md shadow-lg border backdrop-blur-sm",
            clipboardStatus === "error" &&
              "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300",
            clipboardStatus === "loading" &&
              "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
          )}
        >
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4" />
            {clipboardStatus === "error" &&
              "Clipboard not available - manual text entry required"}
            {clipboardStatus === "loading" && "Loading demo content..."}
          </div>
        </motion.div>
      )}

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
                <HighlightOverlay
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
