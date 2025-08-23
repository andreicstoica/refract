"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/helpers";
import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatedText } from "./ui/AnimatedText";
import { Pin } from "lucide-react";

interface ChipProps {
  text: string;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  horizontalOffset?: number;
  verticalOffset?: number;
  className?: string;
  onFadeComplete?: () => void;
  onKeepChip?: () => void;
}

export function Chip({
  text,
  position,
  horizontalOffset = 0,
  verticalOffset = 0,
  className,
  onFadeComplete,
  onKeepChip,
}: ChipProps) {
  const [shouldFade, setShouldFade] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);

  // Memoize position calculations to avoid recalculation on every render
  // Position is relative to textarea content area, chip overlay is relative to textarea container
  // Position chip right under the sentence with horizontal offset for side-by-side layout
  const chipTop = useMemo(() => {
    const measured = position.height ?? 44;
    const lineOffset = Math.min(44, measured); // cap to 44px so chips sit closer
    return position.top + lineOffset + 4 + verticalOffset; // small gap below line
  }, [position.top, position.height, verticalOffset]);
  const chipLeft = useMemo(() => {
    // Clamp to the start of the textarea content (px-4 => 16px)
    const baseLeft = position.left + 16 + horizontalOffset;
    return Math.max(16, baseLeft);
  }, [position.left, horizontalOffset]);

  // Start fade after 8 seconds
  useEffect(() => {
    // Skip scheduling fade if pinned
    if (pinned) return;
    // Schedule fade start
    const id = window.setTimeout(() => {
      // Only start fading if not pinned at that moment
      setShouldFade((prev) => (pinned ? prev : true));
    }, 8000);
    fadeTimerRef.current = id;
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [pinned]);

  // Handle tap to keep chip
  const handleTap = () => {
    if (pinned) return; // already pinned
    setPinned(true);
    setShouldFade(false);
    setIsVisible(true); // Ensure chip is visible when pinned
    onKeepChip?.();
  };

  // Debug positioning in development
  if (process.env.NODE_ENV !== "production") {
    console.log("🎯 Chip positioning:", {
      text: text.substring(0, 30) + "...",
      position,
      horizontalOffset,
      chipTop,
      chipLeft,
    });
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{
            opacity: shouldFade ? 0 : 1,
            scale: 1,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            duration: shouldFade ? 4 : 0, // No initial animation, just fade
            ease: "easeOut",
          }}
          onAnimationComplete={() => {
            if (shouldFade) {
              setIsVisible(false);
              onFadeComplete?.();
            }
          }}
          className={cn(
            "absolute z-20 text-sm font-medium text-blue-600 dark:text-blue-400",
            "leading-tight cursor-pointer group inline-flex items-center",
            "whitespace-nowrap", // Keep chips single-line
            // Always allow interactions so chips can be pinned anytime
            "pointer-events-auto",
            className
          )}
          style={{
            top: chipTop,
            left: chipLeft,
          }}
          onClick={handleTap}
        >
          <AnimatedText
            text={text}
            duration={1500} // 1.5 seconds for handwriting animation
            delay={0} // Start immediately
          />
          <Pin
            size={14}
            className={cn(
              "ml-0.5 rotate-[12deg]", // tighter gap next to text
              // gentle appear animation on hover
              "transition-all duration-200 ease-out",
              pinned
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-0.5 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100"
            )}
            aria-hidden="true"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
