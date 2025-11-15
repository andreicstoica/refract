"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { cn } from "@/lib/helpers";
import { storage } from "@/services/storage";
import { TimerControls } from "./TimerControls";
import { Intro } from "./Intro";
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
  const [isPage1Entering, setIsPage1Entering] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const stagingRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prevMinutesRef = useRef(selectedMinutes);

  useEffect(() => {
    if (isOpen && storage.getHasSeenIntro()) {
      setCurrentPage(1);
    }
  }, [isOpen]);

  useEffect(() => {
    prevMinutesRef.current = selectedMinutes;
  }, [selectedMinutes]);

  useEffect(() => {
    if (isTransitioningRef.current) return;
    if (contentRef.current) {
      gsap.set(contentRef.current.children, { opacity: 1, x: 0 });
    }
  }, [currentPage]);

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleStart = () => {
    onStart(selectedMinutes);
  };

  const handleNext = () => {
    if (!contentRef.current || !modalRef.current || !stagingRef.current) return;

    isTransitioningRef.current = true;
    setIsPage1Entering(true);
    storage.setHasSeenIntro(true);

    if (tlRef.current) {
      tlRef.current.kill();
      tlRef.current = null;
    }

    const modalEl = modalRef.current;
    const contentEl = contentRef.current;
    const stageEl = stagingRef.current;
    if (!modalEl || !contentEl || !stageEl) return;

    const currentHeight = modalEl.offsetHeight;
    const targetHeight = stageEl.offsetHeight;

    gsap.set(modalEl, { height: currentHeight });

    const tl = gsap
      .timeline()
      .to(contentEl.children, {
        opacity: 0,
        x: -25,
        duration: 0.4,
        ease: "power2.inOut",
        stagger: 0.08,
      })
      .to(
        modalEl,
        {
          height: targetHeight,
          duration: 0.4,
          ease: "power2.out",
        },
        ">-0.1"
      )
      .call(() => {
        setCurrentPage(1);
      })
      .call(
        () => {
          requestAnimationFrame(() => {
            if (!contentRef.current || !modalRef.current) return;
            const inner = contentRef.current;
            const modalNow = modalRef.current;

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

  useModalKeyboard({
    isOpen,
    currentPage,
    selectedMinutes,
    inputBuffer,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onStart: handleStart,
    onMinutesChange: (minutes) => {
      const prevMinutes = prevMinutesRef.current;
      setSelectedMinutes(minutes);

      if (minutes > prevMinutes) {
        setNumberDirection("up");
        setArrowPressed("up");
      } else if (minutes < prevMinutes) {
        setNumberDirection("down");
        setArrowPressed("down");
      }

      setTimeout(() => {
        setNumberDirection(null);
        setArrowPressed(null);
      }, 200);
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
                <Intro onNext={handleNext} isEnterPressed={isEnterPressed} />
              )}

              {currentPage === 1 && (
                <div
                  className="space-y-8"
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
