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
  // Smart positioning to prevent overflow
  const chipWidth = Math.min(Math.max(text.length * 8 + 24, 100), 200); // Estimate width
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const rightEdgePosition = position.left + position.width + 8 + chipWidth;
  
  // If chip would overflow, position it to the left or below instead
  const willOverflow = rightEdgePosition > viewportWidth - 20;
  const chipLeft = willOverflow 
    ? Math.max(20, position.left - chipWidth - 8) // Position to the left
    : position.left + position.width + 8; // Position to the right
    
  const chipTop = willOverflow && chipLeft < position.left
    ? position.top + position.height + 4 // Position below if moved to left
    : position.top + position.height / 2 - 16; // Center with sentence

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "absolute z-20 pointer-events-none",
        "bg-blue-500/20 border border-blue-500/40 rounded-lg px-3 py-2",
        "text-sm text-blue-700 dark:text-blue-300 font-medium",
        "shadow-lg backdrop-blur-sm",
        "whitespace-nowrap", // Prevent text wrapping
        className
      )}
      style={{
        top: chipTop,
        left: chipLeft,
        maxWidth: "200px",
        minWidth: "100px",
      }}
    >
      {text}
    </motion.div>
  );
}