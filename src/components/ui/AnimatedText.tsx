"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/helpers";

interface AnimatedTextProps {
  text: string;
  className?: string;
  duration?: number; // Animation duration in ms
  delay?: number; // Delay before animation starts
  onAnimationComplete?: () => void;
  reverse?: boolean; // If true, animate out (right-to-left, bottom-up)
}

export function AnimatedText({
  text,
  className,
  duration = 2000,
  delay = 0,
  onAnimationComplete,
  reverse = false,
}: AnimatedTextProps) {
  const TOTAL_STEPS = 60;
  const [revealProgress, setRevealProgress] = useState(reverse ? 100 : 0);
  const completionRef = useRef(onAnimationComplete);

  useEffect(() => {
    completionRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    let animation: ReturnType<typeof window.setInterval> | null = null;
    const stepDuration = duration / TOTAL_STEPS || 0;

    // Reset to the initial state whenever the animation restarts
    setRevealProgress(reverse ? 100 : 0);

    const startTimer = window.setTimeout(() => {
      let currentStep = 0;

      animation = setInterval(
        () => {
          currentStep += 1;
          const progress = Math.min((currentStep / TOTAL_STEPS) * 100, 100);

          if (reverse) {
            setRevealProgress(100 - progress);
          } else {
            setRevealProgress(progress);
          }

          if (currentStep >= TOTAL_STEPS) {
            if (animation) {
              window.clearInterval(animation);
              animation = null;
            }
            completionRef.current?.();
          }
        },
        stepDuration > 0 ? stepDuration : 16
      ); // fallback to ~60fps
    }, delay);

    return () => {
      window.clearTimeout(startTimer);
      if (animation) {
        window.clearInterval(animation);
      }
    };
  }, [text, duration, delay, reverse]);

  return (
    <div className={cn("relative", className)}>
      {/* Background text (hidden) */}
      <span className="font-cursive text-blue-600 dark:text-blue-400 text-sm opacity-0">
        {text}
      </span>

      {/* Animated text with gradient mask */}
      <span
        className="font-cursive text-blue-600 dark:text-blue-400 text-sm absolute top-0 left-0"
        style={{
          WebkitMask: reverse
            ? `linear-gradient(to left, transparent ${revealProgress}%, black ${revealProgress}%, black 100%)`
            : `linear-gradient(to right, black 0%, black ${revealProgress}%, transparent ${revealProgress}%)`,
          mask: reverse
            ? `linear-gradient(to left, transparent ${revealProgress}%, black ${revealProgress}%, black 100%)`
            : `linear-gradient(to right, black 0%, black ${revealProgress}%, transparent ${revealProgress}%)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
