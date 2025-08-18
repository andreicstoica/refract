"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DoneButtonProps {
  textLength: number;
  onDone: () => void;
  isProcessing?: boolean;
  threshold?: number;
  className?: string;
}

export function DoneButton({
  textLength,
  onDone,
  isProcessing = false,
  threshold = 1000,
  className,
}: DoneButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const shouldShow = textLength >= threshold && !isProcessing;
  const progressPercentage = Math.min(100, (textLength / threshold) * 100);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{
            duration: 0.4,
            ease: "easeOut",
            delay: 0.1, // Subtle delay for gentle introduction
          }}
          onClick={onDone}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={isProcessing}
          className={cn(
            "relative overflow-hidden",
            "px-6 py-3 rounded-full",
            "bg-gradient-to-r from-blue-500/20 to-purple-500/20",
            "border border-blue-400/30",
            "text-blue-700 dark:text-blue-300",
            "font-medium text-sm",
            "transition-all duration-200",
            "hover:from-blue-500/30 hover:to-purple-500/30",
            "hover:border-blue-400/50",
            "hover:shadow-lg hover:shadow-blue-500/20",
            "focus:outline-none focus:ring-2 focus:ring-blue-400/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "backdrop-blur-sm",
            className
          )}
        >
          {/* Background glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full"
            animate={{
              opacity: isHovered ? 1 : 0,
              scale: isHovered ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
          />

          {/* Button content */}
          <span className="relative z-10 flex items-center gap-2">
            {isProcessing ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Analyzing themes...
              </>
            ) : (
              <>
                <motion.div
                  className="w-2 h-2 bg-blue-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                Done writing
              </>
            )}
          </span>

          {/* Subtle pulse effect */}
          <motion.div
            className="absolute inset-0 rounded-full border border-blue-400/20"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// Optional: Export threshold constant for reuse
export const DEFAULT_DONE_THRESHOLD = 1000;