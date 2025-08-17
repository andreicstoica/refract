"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AnimatedTextProps {
  text: string;
  className?: string;
  duration?: number; // Animation duration in ms
  delay?: number; // Delay before animation starts
  onAnimationComplete?: () => void;
}

export function AnimatedText({
  text,
  className,
  duration = 2000,
  delay = 0,
  onAnimationComplete,
}: AnimatedTextProps) {
  const [revealProgress, setRevealProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setIsAnimating(true);

      const stepDuration = duration / 60; // 60fps for smooth animation

      let currentStep = 0;
      const animation = setInterval(() => {
        currentStep++;
        const progress = (currentStep / 60) * 100;
        setRevealProgress(progress);

        if (currentStep >= 60) {
          clearInterval(animation);
          onAnimationComplete?.();
        }
      }, stepDuration);

      return () => clearInterval(animation);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, duration, delay, onAnimationComplete]);

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
          WebkitMask: `linear-gradient(to right, black 0%, black ${revealProgress}%, transparent ${revealProgress}%)`,
          mask: `linear-gradient(to right, black 0%, black ${revealProgress}%, transparent ${revealProgress}%)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
