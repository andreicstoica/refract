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

  // Improved bubble layout using full screen height and better spacing
  const bubblePositions = useMemo(() => {
    if (themes.length === 0) return [];

    const bubbles = themes.map((theme, index) => ({
      theme,
      size: 80 + theme.confidence * 40,
      radius: (80 + theme.confidence * 40) / 2, // Actual radius for collision detection
    }));

    // Simple grid-based layout that uses full screen
    if (themes.length === 1) {
      return [
        {
          theme: bubbles[0].theme,
          position: { x: 50, y: 50 },
          size: bubbles[0].size,
        },
      ];
    }

    if (themes.length === 2) {
      const positions = [
        {
          theme: bubbles[0].theme,
          position: { x: 30, y: 25 },
          size: bubbles[0].size,
        },
        {
          theme: bubbles[1].theme,
          position: { x: 70, y: 75 },
          size: bubbles[1].size,
        },
      ];
      console.log("2-bubble positions:", positions);
      return positions;
    }

    // For 3+ bubbles, use improved spacing
    const positions: Array<{
      theme: Theme;
      position: { x: number; y: number };
      size: number;
    }> = [];

    // Calculate positions to maximize usage of vertical space
    const rows = Math.ceil(Math.sqrt(themes.length));
    const cols = Math.ceil(themes.length / rows);

    bubbles.forEach((bubble, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;

      // Use full vertical space (15% to 85%)
      const x = 15 + (70 / (cols - 1 || 1)) * col;
      const y = 15 + (70 / (rows - 1 || 1)) * row;

      // Add some organic randomness but keep good separation
      const randomX = (Math.random() - 0.5) * 8;
      const randomY = (Math.random() - 0.5) * 8;

      positions.push({
        theme: bubble.theme,
        position: {
          x: Math.max(15, Math.min(85, x + randomX)),
          y: Math.max(15, Math.min(85, y + randomY)),
        },
        size: bubble.size,
      });
    });

    return positions;
  }, [themes]);

  // Calculate displaced positions when a bubble is expanded
  const adjustedPositions = useMemo(() => {
    if (!expandedTheme) return bubblePositions;

    const expandedIndex = bubblePositions.findIndex(
      (bp) => bp.theme.id === expandedTheme
    );
    if (expandedIndex === -1) return bubblePositions;

    const expanded = bubblePositions[expandedIndex];
    const pushRadius = 35; // How far to push other bubbles away

    return bubblePositions.map((bp, index) => {
      if (index === expandedIndex) return bp; // Don't move the expanded bubble

      const dx = bp.position.x - expanded.position.x;
      const dy = bp.position.y - expanded.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < pushRadius) {
        // Push bubble away
        const pushAngle = Math.atan2(dy, dx);
        const newDistance = pushRadius + 5;
        const newX = expanded.position.x + Math.cos(pushAngle) * newDistance;
        const newY = expanded.position.y + Math.sin(pushAngle) * newDistance;

        // Keep within bounds
        const boundedX = Math.max(10, Math.min(90, newX));
        const boundedY = Math.max(10, Math.min(90, newY));

        return {
          ...bp,
          position: { x: boundedX, y: boundedY },
        };
      }

      return bp;
    });
  }, [bubblePositions, expandedTheme]);

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
        {adjustedPositions.map(({ theme, position, size }) => (
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


      {/* Instructions overlay */}
      {themes.length > 0 && !expandedTheme && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        ></motion.div>
      )}

    </motion.div>
  );
}
