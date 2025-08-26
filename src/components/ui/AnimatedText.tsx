"use client";

import { useState, useEffect } from "react";
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
  const [revealProgress, setRevealProgress] = useState(reverse ? 100 : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setIsAnimating(true);

      const stepDuration = duration / 60; // 60fps for smooth animation

      let currentStep = 0;
      const animation = setInterval(() => {
        currentStep++;
        const progress = (currentStep / 60) * 100;
        
        if (reverse) {
          // Animate from 100 to 0 for reverse (out) animation
          setRevealProgress(100 - progress);
        } else {
          // Animate from 0 to 100 for normal (in) animation
          setRevealProgress(progress);
        }

        if (currentStep >= 60) {
          clearInterval(animation);
          onAnimationComplete?.();
        }
      }, stepDuration);

      return () => clearInterval(animation);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, duration, delay, onAnimationComplete, reverse]);

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
