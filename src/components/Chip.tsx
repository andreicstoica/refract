"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChipProps {
  text: string;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  className?: string;
}

export function Chip({ text, position, className }: ChipProps) {
  // Position chip in the space between lines (below the sentence)
  const chipTop = position.top + position.height + 4; // 4px gap below sentence
  const chipLeft = position.left; // Align with sentence start instead of end

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "absolute z-20 pointer-events-none text-xs font-medium text-blue-600 dark:text-blue-400",
        "leading-tight", // Remove max-width, let them be natural width
        className
      )}
      style={{
        top: chipTop,
        left: chipLeft,
      }}
    >
      {text}
    </motion.div>
  );
}
