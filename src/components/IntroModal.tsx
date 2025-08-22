"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { cn } from "@/lib/helpers";
import { storage } from "@/services/storage";
import { CornerDownLeft } from "lucide-react";
import { TimerControls } from "./TimerControls";
import { IntroPage } from "./IntroPage";
import { animateModalTransition } from "@/lib/modalAnimation";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";

interface IntroModalProps {
  isOpen: boolean;
  onStart: (minutes: number) => void;
  className?: string;
}

export function IntroModal({ isOpen, onStart, className }: IntroModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(1);
  const [inputBuffer, setInputBuffer] = useState("");
  const [isEnterPressed, setIsEnterPressed] = useState(false);
  const [numberDirection, setNumberDirection] = useState<"up" | "down" | null>(
    null
  );
  const [arrowPressed, setArrowPressed] = useState<"up" | "down" | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const stagingRef = useRef<HTMLDivElement>(null);
  // Track whether we're running the page transition animation to avoid
  // clobbering GSAP with the reset effect below.
  const isTransitioningRef = useRef(false);
  // Single GSAP timeline instance to avoid duplicate animations in dev/StrictMode
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  // Flag to render the next page pre-hidden (prevents one-frame flash)
  const [isPage1Entering, setIsPage1Entering] = useState(false);

  // Check if user has seen intro before
  useEffect(() => {
    if (isOpen && storage.getHasSeenIntro()) {
      setCurrentPage(1); // Skip to timer setup
    }
  }, [isOpen]);

  // Reset content position when page changes only if not mid-transition
  // (e.g., initial render or skip-to-timer path).
  useEffect(() => {
    if (isTransitioningRef.current) return;
    if (contentRef.current) {
      gsap.set(contentRef.current.children, { opacity: 1, x: 0 });
    }
  }, [currentPage]);

  const handleStart = () => {
    onStart(selectedMinutes);
  };

  const handleNext = () => {
    if (!contentRef.current || !modalRef.current || !stagingRef.current) return;
    // Prevent reset effect from interfering during the transition
    isTransitioningRef.current = true;
    setIsPage1Entering(true);

    storage.setHasSeenIntro(true); // Mark intro as seen

    // Kill any previous timeline before starting a new one
    if (tlRef.current) {
      tlRef.current.kill();
      tlRef.current = null;
    }

    // Use the animation utility
    const timeline = animateModalTransition({
      contentRef,
      modalRef,
      stagingRef,
      onPageChange: () => setCurrentPage(1),
      onAnimationComplete: () => {
        isTransitioningRef.current = false;
        setIsPage1Entering(false);
      },
    });
    tlRef.current = timeline || null;
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  // Use the keyboard hook
  useModalKeyboard({
    isOpen,
    currentPage,
    selectedMinutes,
    inputBuffer,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onStart,
    onMinutesChange: (minutes) => {
      setSelectedMinutes(minutes);
      // Trigger animation states for keyboard input
      if (minutes > selectedMinutes) {
        setNumberDirection("up");
        setArrowPressed("up");
        setTimeout(() => {
          setNumberDirection(null);
          setArrowPressed(null);
        }, 200);
      } else if (minutes < selectedMinutes) {
        setNumberDirection("down");
        setArrowPressed("down");
        setTimeout(() => {
          setNumberDirection(null);
          setArrowPressed(null);
        }, 200);
      }
    },
    onInputBufferChange: setInputBuffer,
    onEnterPressed: setIsEnterPressed,
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border border-border/50 rounded-md p-8 max-w-sm w-full",
              "shadow-xl dark:shadow-2xl dark:shadow-black/50",
              className
            )}
            style={{ overflow: "hidden" }}
            role="dialog"
            aria-modal="true"
          >
            {/* Hidden staging area to measure timer page height */}
            <div
              ref={stagingRef}
              className="absolute -top-[9999px] left-0 text-center space-y-8 p-8 max-w-sm w-full opacity-0 pointer-events-none"
              aria-hidden="true"
            >
              {/* Timer Setup Page - for height measurement */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="text-muted-foreground text-md">
                  How long would you like to write?
                </div>
                <p className="text-xs text-muted-foreground">
                  You can pause, resume, or skip the timer at any time
                </p>
              </div>

              {/* Clock Display */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <button className="p-2 rounded-full">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <div className="text-4xl font-mono tabular-nums">
                    {selectedMinutes.toString().padStart(2, "0")}
                  </div>
                  <button className="p-2 rounded-full">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {selectedMinutes === 1 ? "minute" : "minutes"}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button className="group w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-colors">
                Start Writing
                <CornerDownLeft className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>

            <div ref={contentRef} className="text-center space-y-8">
              {currentPage === 0 && (
                <IntroPage
                  onNext={handleNext}
                  isEnterPressed={isEnterPressed}
                />
              )}

              {currentPage === 1 && (
                <div
                  className="space-y-8"
                  // Pre-hide and offset the timer page during entry to prevent flash
                  style={
                    isPage1Entering
                      ? { opacity: 0, transform: "translateX(25px)" }
                      : undefined
                  }
                >
                  <TimerControls
                    selectedMinutes={selectedMinutes}
                    onMinutesChange={setSelectedMinutes}
                    onStart={handleStart}
                    isEnterPressed={isEnterPressed}
                    numberDirection={numberDirection}
                    arrowPressed={arrowPressed}
                    onNumberDirectionChange={setNumberDirection}
                    onArrowPressedChange={setArrowPressed}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
