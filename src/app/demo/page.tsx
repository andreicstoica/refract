"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { useEmbeddings } from "@/features/ai/EmbeddingsProvider";
import { useViewportKeyboardCSSVar } from "@/features/ui/hooks/useViewportKeyboard";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { HighlightLayer } from "@/components/highlight/HighlightLayer";
import { rangesFromThemes } from "@/lib/highlight";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, Clipboard } from "lucide-react";
import { cn } from "@/lib/helpers";
import type { Sentence, SentencePosition } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { AnimatePresence, motion } from "framer-motion";
import { prewarmProd } from "@/services/prodClient";
import { usePageScrollLock } from "@/features/ui/hooks/usePageScrollLock";
import { useHeaderRevealAnimation } from "@/features/ui/hooks/useHeaderRevealAnimation";
import { DEMO_TEXT } from "@/lib/demoMode";

export default function DemoPage() {
  const { generateThemes: generate, isGenerating } = useEmbeddings();

  // Enable keyboard-safe spacing via CSS variables
  useViewportKeyboardCSSVar();

  // Timer + intro state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [clipboardStatus, setClipboardStatus] = useState<
    "loading" | "error" | null
  >(null);

  // Writing state
  const [currentText, setCurrentText] = useState("");
  const [currentSentences, setCurrentSentences] = useState<Sentence[]>([]);

  // Theme state - simple, direct
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  // Create textarea ref for HighlightLayer
  const textareaRefObject = useRef<HTMLTextAreaElement>(null as any);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const reloadButtonRef = useRef<HTMLButtonElement | null>(null);
  usePageScrollLock();

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
            console.error(
              "Failed to load demo content to clipboard:",
              retryError
            );
            setClipboardStatus("error");
          }
        }, 500);
      }
    };

    loadClipboard();

    // Warm the prod pipeline in demo to reduce first prod latency
    prewarmProd();
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

  // Handle textarea ref for HighlightLayer
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRefObject.current = el!; // Non-null assertion since TextInput always provides valid element
  }, []);

  // HighlightLayer handles its own scroll sync via useRafScroll - no manual sync needed

  // Animate header transition: smooth layout change from center to space-between
  // hasThemes computed above

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
