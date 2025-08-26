"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntroModal } from "@/components/IntroModal";
import { WritingTimer } from "@/components/WritingTimer";
import { TextInput } from "@/components/TextInput";
import { useGenerateEmbeddings } from "@/hooks/useGenerateEmbeddings";
import { useViewportKeyboardCSSVar } from "@/hooks/useViewportKeyboard";
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
import { gsap } from "gsap";
import { AnimatePresence, motion } from "framer-motion";

// Sample journaling content for demo
const DEMO_TEXT = `Bootcamp mode again. Demo in less than two weeks now. Time moves fast, but also slow. App works in chunks. Each piece fine on its own. Together? Still messy. Not a story yet. Needs arc. Needs one clear takeaway. Judges won’t remember the tech stack. They’ll remember how it felt.
Morning: tried polishing the layout. Fonts, spacing, small animations. Makes it feel more real. Then broke the data sync. Classic. Two hours gone. Fixed it, but left with that tired feeling—progress, but sideways. Everyone in Slack is on the same rollercoaster. Debug screenshots, half-jokes, late-night commits. Whole cohort vibrating with stress and pride.
I keep circling back to the pitch. Ninety seconds. Show, not tell. Hook early, wow moment, clean close. I wrote it out again. Fewer words. More clicks. Then too many clicks. Judges won’t wait. Every extra step is a chance to lose them. Need to simplify.
Practiced once, recorded on Loom. Awkward. Talking too fast. Forgetting to pause. Harder than coding, honestly. But useful—watching it back shows what lands, what drags.
Plan for tomorrow: cut one more feature, tighten flow. Trust the basics. Remind myself: not about showing everything I built. It’s about showing the one thing that matters.`;

export default function DemoPage() {
  const { generate, isGenerating } = useGenerateEmbeddings();

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
  const prevHasThemesRef = useRef(false);

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

  // Aggressive scroll lock for mobile
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyClasses = document.body.className;
    const originalDocumentElementOverflow =
      document.documentElement.style.overflow;
    const originalBodyPosition = document.body.style.position;

    // CSS-based scroll lock
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("full-vh");

    // JavaScript-based scroll prevention for stubborn mobile browsers
    const preventScroll = (e: TouchEvent | WheelEvent) => {
      const target = e.target as HTMLElement;

      // Allow scrolling only on textarea and scrollable elements
      if (target.tagName === "TEXTAREA" || target.closest(".scrollable")) {
        return;
      }

      // Prevent all other scrolling
      e.preventDefault();
    };

    const preventKeyboardScroll = (e: KeyboardEvent) => {
      // Prevent arrow keys, page up/down, etc. from scrolling the page
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          "Space",
        ].includes(e.key)
      ) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }
    };

    // Add passive: false to ensure preventDefault works
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("keydown", preventKeyboardScroll);

    // Prevent context menu which can interfere with touch handling
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = "";
      document.body.style.height = "";
      document.documentElement.style.overflow = originalDocumentElementOverflow;
      document.body.className = originalBodyClasses;

      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("keydown", preventKeyboardScroll);
      document.removeEventListener("contextmenu", (e) => e.preventDefault());
    };
  }, []);

  // Handle textarea ref for HighlightLayer
  const handleTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRefObject.current = el!; // Non-null assertion since TextInput always provides valid element
  }, []);

  // HighlightLayer handles its own scroll sync via useRafScroll - no manual sync needed

  // Whether we have themes to reveal
  const hasThemes = Boolean(themes && themes.length > 0);

  // Animate header transition: smooth layout change from center to space-between
  useEffect(() => {
    if (!hasThemes || prevHasThemesRef.current) return;
    prevHasThemesRef.current = true;
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const headerContainer = document.querySelector(
      "[data-header-container]"
    ) as HTMLElement;
    const timerContainer = headerContainer?.querySelector(
      "[data-timer-container]"
    ) as HTMLElement;

    if (headerContainer && timerContainer && chipsRef.current) {
      // Create GSAP timeline for smooth layout transition
      const tl = gsap.timeline();

      // Phase 1: Switch to space-between layout immediately but keep timer centered with transforms
      tl.call(() => {
        if (headerContainer) {
          headerContainer.classList.remove("justify-center");
          headerContainer.classList.add("justify-between");
          // Calculate how much to move timer to keep it centered initially
          const containerWidth = headerContainer.offsetWidth;
          // Get just the timer width (first child is the WritingTimer)
          const timerEl = timerContainer.firstElementChild as HTMLElement;
          const timerWidth = timerEl?.offsetWidth || 0;
          const centerOffset = containerWidth / 2 - timerWidth / 2;
          gsap.set(timerContainer, { x: centerOffset });

          // Hide reload button initially
          if (reloadButtonRef.current) {
            gsap.set(reloadButtonRef.current, { opacity: 0, scale: 0.98 });
          }
        }
      })
        // Phase 2: Smoothly animate timer from center to left over 1 second
        .to(timerContainer, {
          x: 0, // Move to natural left position
          duration: 1,
          ease: "sine.inOut",
        })
        // Phase 3: Fade in reload button first
        .fromTo(
          reloadButtonRef.current,
          { opacity: 0, scale: 0.98 },
          { opacity: 1, scale: 1, duration: 0.9, ease: "sine.inOut" },
          ">-0.25" // Start 0.75s after timer starts moving
        )
        // Phase 4: Gently fade/scale in theme buttons (no slide)
        .fromTo(
          chipsRef.current,
          { opacity: 0, scale: 0.98 },
          { opacity: 1, scale: 1, duration: 0.9, ease: "sine.inOut" },
          "<" // Start at the same time as reload button
        );
    }
  }, [hasThemes]);

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
