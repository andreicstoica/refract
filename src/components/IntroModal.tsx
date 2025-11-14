"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { cn } from "@/lib/helpers";
import { storage } from "@/services/storage";
import { TimerControls } from "./TimerControls";
import { Intro } from "./Intro";

interface IntroModalProps {
  isOpen: boolean;
  onStart: (minutes: number) => void;
  className?: string;
}

export function IntroModal({ isOpen, onStart, className }: IntroModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(1);
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

    // Inline transition: measure, animate out, resize, swap, animate in
    const modalEl = modalRef.current;
    const contentEl = contentRef.current;
    const stageEl = stagingRef.current;
    if (!modalEl || !contentEl || !stageEl) return;

    const currentHeight = modalEl.offsetHeight;
    const targetHeight = stageEl.offsetHeight;

    // Fix current height so the card doesn’t jump while content animates out
    gsap.set(modalEl, { height: currentHeight });

    const tl = gsap
      .timeline()
      // Fade out current content to the left with slight stagger
      .to(contentEl.children, {
        opacity: 0,
        x: -25,
        duration: 0.4,
        ease: "power2.inOut",
        stagger: 0.08,
      })
      // Resize the modal to the target height
      .to(
        modalEl,
        {
          height: targetHeight,
          duration: 0.4,
          ease: "power2.out",
        },
        ">-0.1"
      )
      // Swap to page 1
      .call(() => {
        setCurrentPage(1);
      })
      // Animate new content in from the right after React commits
      .call(
        () => {
          // After React commits page 1, animate new content in
          requestAnimationFrame(() => {
            if (!contentRef.current || !modalRef.current) return;
            const inner = contentRef.current;
            const modalNow = modalRef.current;

            // Initial state for children, then animate in
            gsap.set(inner.children, { opacity: 0, x: 25 });
            gsap.to(inner.children, {
              opacity: 1,
              x: 0,
              duration: 0.5,
              ease: "power2.out",
              stagger: 0.1,
              onComplete: () => {
                gsap.set(modalNow, { height: "auto" });
                isTransitioningRef.current = false;
                setIsPage1Entering(false);
              },
            });
          });
        },
        [],
        ">+0.15"
      );

    tlRef.current = tl;
  };

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
              className="absolute -top-[9999px] left-0 text-center space-y-8 p-8 border border-border/50 rounded-md max-w-sm w-full opacity-0 pointer-events-none"
              aria-hidden="true"
            >
              <TimerControls
                selectedMinutes={selectedMinutes}
                onMinutesChange={() => {}}
                onStart={() => {}}
                isEnterPressed={false}
              />
            </div>

            <div ref={contentRef} className="text-center space-y-8">
              {currentPage === 0 && (
                <Intro onNext={handleNext} isEnterPressed={false} />
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
                    isEnterPressed={false}
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
