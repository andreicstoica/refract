"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { cn } from "@/lib/helpers";
import { storage } from "@/services/storage";
import {
  ChevronUp,
  ChevronDown,
  CornerDownLeft,
  ChevronRight,
} from "lucide-react";

interface IntroModalProps {
  isOpen: boolean;
  onStart: (minutes: number) => void;
  className?: string;
}

export function IntroModal({ isOpen, onStart, className }: IntroModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(1);
  const [inputBuffer, setInputBuffer] = useState("");
  const bufferResetRef = useRef<number | null>(null);
  const minutesRef = useRef(selectedMinutes);
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const stagingRef = useRef<HTMLDivElement>(null);

  // Check if user has seen intro before
  useEffect(() => {
    if (isOpen && storage.getHasSeenIntro()) {
      setCurrentPage(1); // Skip to timer setup
    }
  }, [isOpen]);

  // Reset content position when page changes (for initial render and skips)
  useEffect(() => {
    if (contentRef.current) {
      gsap.set(contentRef.current.children, { opacity: 1, x: 0 });
    }
  }, [currentPage]);

  useEffect(() => {
    minutesRef.current = selectedMinutes;
  }, [selectedMinutes]);

  const handleIncrement = () => {
    setSelectedMinutes((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setSelectedMinutes((prev) => Math.max(1, prev - 1));
  };

  const handleStart = () => {
    onStart(selectedMinutes);
  };

  const handleNext = () => {
    if (!contentRef.current || !modalRef.current || !stagingRef.current) return;
    
    storage.setHasSeenIntro(true); // Mark intro as seen
    
    // Get current modal height and measure target height from staging div
    const currentHeight = modalRef.current.offsetHeight;
    const targetHeight = stagingRef.current.offsetHeight;
    
    // GSAP animation with precise height values
    const tl = gsap.timeline();
    
    // Set modal to fixed current height for smooth animation
    gsap.set(modalRef.current, { height: currentHeight });
    
    // Fade out current content to the left with stagger
    tl.to(contentRef.current.children, {
      opacity: 0,
      x: -25,
      duration: 0.4,
      ease: "power2.inOut",
      stagger: 0.08
    })
    // Animate modal height to exact target height
    .to(modalRef.current, {
      height: targetHeight,
      duration: 0.4,
      ease: "power2.out"
    }, ">-0.1")
    // Update page state
    .call(() => {
      setCurrentPage(1);
    })
    // Set new content to start from the right, then animate in with stagger
    .set(contentRef.current.children, {
      opacity: 0,
      x: 25
    })
    .to(contentRef.current.children, {
      opacity: 1,
      x: 0,
      duration: 0.5,
      ease: "power2.out",
      stagger: 0.1
    }, ">+0.15")
    // Reset modal height to auto after animation completes
    .set(modalRef.current, { height: "auto" });
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  // Keyboard handling when the modal is open
  useEffect(() => {
    if (!isOpen) return;

    const resetBufferSoon = () => {
      if (bufferResetRef.current) {
        window.clearTimeout(bufferResetRef.current);
      }
      bufferResetRef.current = window.setTimeout(() => {
        setInputBuffer("");
        bufferResetRef.current = null;
      }, 1000);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Intercept only the keys we care about
      const { key } = event;

      // Page navigation
      if (key === "ArrowRight" && currentPage < 1) {
        event.preventDefault();
        event.stopPropagation();
        handleNext();
        return;
      }
      if (key === "ArrowLeft" && currentPage > 0) {
        event.preventDefault();
        event.stopPropagation();
        handlePrevious();
        return;
      }

      // Only handle timer controls on page 1 (timer setup)
      if (currentPage === 1) {
        // Arrow handling for timer
        if (key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          setSelectedMinutes((prev) => prev + 1);
          return;
        }
        if (key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          setSelectedMinutes((prev) => Math.max(1, prev - 1));
          return;
        }

        // Enter starts writing
        if (key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onStart(minutesRef.current);
          return;
        }
      } else if (currentPage === 0) {
        // Enter goes to next page on intro
        if (key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          handleNext();
          return;
        }
      }

      // Numeric entry to set minutes (supports multi-digit) - only on timer page
      if (currentPage === 1 && /^[0-9]$/.test(key)) {
        event.preventDefault();
        event.stopPropagation();
        setInputBuffer((prev) => {
          const next = (prev + key).replace(/^0+(\d)/, "$1");
          const parsed = parseInt(next, 10);
          setSelectedMinutes(Number.isNaN(parsed) ? 1 : Math.max(1, parsed));
          return next;
        });
        resetBufferSoon();
        return;
      }

      // Allow correcting numeric input with Backspace - only on timer page
      if (currentPage === 1 && key === "Backspace") {
        if (inputBuffer.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          setInputBuffer((prev) => {
            const next = prev.slice(0, -1);
            const parsed = parseInt(next || "0", 10);
            setSelectedMinutes(Math.max(1, parsed || 1));
            return next;
          });
          resetBufferSoon();
        }
        return;
      }
    };

    // Use capture to intercept before underlying textarea
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (bufferResetRef.current) {
        window.clearTimeout(bufferResetRef.current);
        bufferResetRef.current = null;
      }
    };
  }, [isOpen, inputBuffer, onStart, currentPage]);

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
            style={{ overflow: 'hidden' }}
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
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <div className="text-4xl font-mono tabular-nums">
                    {selectedMinutes.toString().padStart(2, "0")}
                  </div>
                  <button className="p-2 rounded-full">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {selectedMinutes === 1 ? "minute" : "minutes"}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md font-medium">
                Start Writing
                <CornerDownLeft className="w-4 h-4" />
              </button>
            </div>

            <div ref={contentRef} className="text-center space-y-8">
              {currentPage === 0 && (
                <>
                  {/* Intro Page */}
                  <div className="flex flex-col items-center justify-center gap-6">
                    <h1 className="text-2xl font-semibold text-foreground">
                      Welcome
                    </h1>
                    <div className="space-y-4 text-muted-foreground text-sm">
                      <p>
                        Write about whatever's on your mind. We don't store what
                        you write.
                      </p>
                      <p>
                        Our AI will gently nudge you deeper and surface
                        connections you might have missed.
                      </p>
                    </div>
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNext}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-colors"
                  >
                    Get Started
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {currentPage === 1 && (
                <>
                  {/* Timer Setup Page */}
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
                    {/* Minutes */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleIncrement}
                        className="p-2 hover:bg-muted/70 rounded-full transition-colors"
                      >
                        <ChevronUp className="w-5 h-5 text-foreground" />
                      </button>

                      <div className="text-4xl font-mono tabular-nums text-foreground">
                        {selectedMinutes.toString().padStart(2, "0")}
                      </div>

                      <button
                        onClick={handleDecrement}
                        disabled={selectedMinutes <= 1}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          selectedMinutes <= 1
                            ? "opacity-30 cursor-not-allowed"
                            : "hover:bg-muted/70"
                        )}
                      >
                        <ChevronDown className="w-5 h-5 text-foreground" />
                      </button>

                      <div className="text-xs text-muted-foreground">
                        {selectedMinutes === 1 ? "minute" : "minutes"}
                      </div>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={handleStart}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-colors"
                  >
                    Start Writing
                    <CornerDownLeft className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
