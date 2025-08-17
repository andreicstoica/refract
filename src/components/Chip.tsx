"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface ChipProps {
  text: string;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  className?: string;
  onFadeComplete?: () => void;
  onKeepChip?: () => void;
}

export function Chip({
  text,
  position,
  className,
  onFadeComplete,
  onKeepChip,
}: ChipProps) {
  const [shouldFade, setShouldFade] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Start fade after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldFade(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  // Handle tap to keep chip
  const handleTap = () => {
    if (shouldFade) {
      setShouldFade(false);
      onKeepChip?.();
    }
  };

  // Position chip in the space between lines (below the sentence)
  const chipTop = position.top + position.height + 4;
  const chipLeft = position.left;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{
            opacity: shouldFade ? 0 : 1,
            scale: 1,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            duration: shouldFade ? 1 : 0.3,
            ease: "easeOut",
          }}
          onAnimationComplete={() => {
            if (shouldFade) {
              setIsVisible(false);
              onFadeComplete?.();
            }
          }}
          className={cn(
            "absolute z-20 text-xs font-medium text-blue-600 dark:text-blue-400",
            "leading-tight cursor-pointer",
            shouldFade && "pointer-events-auto", // Enable clicks only when fading
            className
          )}
          style={{
            top: chipTop,
            left: chipLeft,
          }}
          onClick={handleTap}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
