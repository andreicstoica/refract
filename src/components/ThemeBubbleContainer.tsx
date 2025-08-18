"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { ThemeBubble } from "./ThemeBubble";
import { cn } from "@/utils/utils";

import type { Theme } from "@/types/theme";

interface ThemeBubbleContainerProps {
  themes: Theme[];
  onThemeSelect?: (themeId: string) => void;
  className?: string;
}

export function ThemeBubbleContainer({
  themes,
  onThemeSelect,
  className,
}: ThemeBubbleContainerProps) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  // Calculate mindmap-style positions for bubbles
  const bubblePositions = useMemo(() => {
    if (themes.length === 0) return [];

    const centerX = 50; // Percentage from left
    const centerY = 50; // Percentage from top
    const baseRadius = 30; // Base distance from center

    return themes.map((theme, index) => {
      const angle = (index / themes.length) * 2 * Math.PI;
      const radius = baseRadius * (0.8 + theme.confidence * 0.4);

      // Add some randomness to make it feel more organic
      const randomOffset = 0.2;
      const x =
        centerX +
        Math.cos(angle) * radius +
        (Math.random() - 0.5) * randomOffset * 20;
      const y =
        centerY +
        Math.sin(angle) * radius +
        (Math.random() - 0.5) * randomOffset * 20;

      return {
        theme,
        position: { x, y },
        size: 80 + theme.confidence * 40, // Size based on confidence
      };
    });
  }, [themes]);

  const handleExpand = (themeId: string) => {
    setExpandedTheme(themeId);
    onThemeSelect?.(themeId);
  };

  const handleCollapse = () => {
    setExpandedTheme(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative w-full h-full min-h-[400px]",
        "bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-blue-950/20 dark:to-purple-950/20",
        "rounded-2xl border border-blue-200/20",
        "overflow-hidden",
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.1)_1px,transparent_0)] bg-[length:20px_20px]" />
      </div>

      {/* Floating particles in background */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-300/40 rounded-full"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
          style={{
            left: `${10 + i * 10}%`,
            top: `${20 + i * 8}%`,
          }}
        />
      ))}

      {/* Theme bubbles */}
      <AnimatePresence>
        {bubblePositions.map(({ theme, position, size }) => (
          <ThemeBubble
            key={theme.id}
            theme={theme}
            position={position}
            size={size}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            isExpanded={expandedTheme === theme.id}
          />
        ))}
      </AnimatePresence>

      {/* Connection lines between bubbles (optional) */}
      {bubblePositions.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {bubblePositions.map((bubble, index) => {
            const nextBubble =
              bubblePositions[(index + 1) % bubblePositions.length];
            if (!nextBubble) return null;

            // Use percentage positions directly for SVG
            const x1 = bubble.position.x;
            const y1 = bubble.position.y;
            const x2 = nextBubble.position.x;
            const y2 = nextBubble.position.y;

            return (
              <motion.line
                key={`line-${index}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="rgba(59, 130, 246, 0.2)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 1,
                  delay: 0.5 + index * 0.2,
                  ease: "easeOut",
                }}
              />
            );
          })}
        </svg>
      )}

      {/* Instructions overlay */}
      {themes.length > 0 && !expandedTheme && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        >
          <div className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border">
            Tap bubbles to explore themes
          </div>
        </motion.div>
      )}

      {/* Close button when expanded */}
      <AnimatePresence>
        {expandedTheme && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleCollapse}
            className="absolute top-4 right-4 z-50 w-8 h-8 bg-background/90 backdrop-blur-sm border border-blue-200/30 rounded-full flex items-center justify-center text-blue-600 hover:bg-background transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
