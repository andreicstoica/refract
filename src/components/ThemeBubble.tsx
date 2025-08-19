"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/utils/utils";

import type { Theme } from "@/types/theme";

interface ThemeBubbleProps {
  theme: Theme;
  position: { x: number; y: number };
  size: number;
  onExpand?: (themeId: string) => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  className?: string;
}

export function ThemeBubble({
  theme,
  position,
  size,
  onExpand,
  onCollapse,
  isExpanded = false,
  className,
}: ThemeBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (isExpanded) {
      onCollapse?.();
    } else {
      onExpand?.(theme.id);
    }
  };

  // Calculate bubble size based on confidence and chunk count
  const bubbleSize = size * (0.8 + theme.confidence * 0.4);
  const glowIntensity = theme.confidence * 0.6 + 0.2;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: isExpanded ? 2.5 : 1,
        zIndex: isExpanded ? 50 : 10,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        delay: Math.random() * 0.3,
      }}
      className={cn(
        "absolute cursor-pointer select-none",
        "flex items-center justify-center",
        className
      )}
      style={{
        width: bubbleSize,
        height: bubbleSize,
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)", // Center the bubble on its position
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main bubble */}
      <motion.div
        className={cn(
          "relative w-full h-full rounded-full",
          "border backdrop-blur-sm",
          "flex items-center justify-center",
          "overflow-hidden"
        )}
        style={{
          background: theme.color
            ? `linear-gradient(135deg, ${theme.color}20, ${theme.color}10)`
            : "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.1))",
          borderColor: theme.color
            ? `${theme.color}30`
            : "rgba(59, 130, 246, 0.3)",
        }}
        animate={{
          scale: isHovered ? 1.05 : 1,
          boxShadow: isHovered
            ? `0 0 ${20 + glowIntensity * 30}px ${
                theme.color || "rgba(59, 130, 246, 0.6)"
              }`
            : `0 0 ${10 + glowIntensity * 20}px ${
                theme.color || "rgba(59, 130, 246, 0.3)"
              }`,
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Animated background particles */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: theme.color
              ? [
                  `radial-gradient(circle at 20% 20%, ${theme.color}30 0%, transparent 50%)`,
                  `radial-gradient(circle at 80% 80%, ${theme.color}20 0%, transparent 50%)`,
                  `radial-gradient(circle at 20% 20%, ${theme.color}30 0%, transparent 50%)`,
                ]
              : [
                  "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)",
                  "radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
                  "radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)",
                ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Floating particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              backgroundColor: theme.color
                ? `${theme.color}60`
                : "rgba(59, 130, 246, 0.6)",
              left: `${20 + i * 30}%`,
              top: `${30 + i * 20}%`,
            }}
            animate={{
              x: [0, 20, 0],
              y: [0, -20, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 text-center px-2">
          <motion.div
            className="text-xs font-medium"
            style={{
              color: theme.color ? theme.color : "rgb(29, 78, 216)", // Default blue
            }}
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            {theme.label}
          </motion.div>

          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] mt-1"
              style={{
                color: theme.color
                  ? `${theme.color}70`
                  : "rgba(29, 78, 216, 0.7)",
              }}
            >
              {theme.chunkCount} segments
            </motion.div>
          )}
        </div>

        {/* Expansion indicator */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
          />
        )}
      </motion.div>

      {/* Sentence clips arranged around expanded bubble */}
      <AnimatePresence>
        {isExpanded && theme.chunks && (
          <>
            {theme.chunks.slice(0, 8).map((chunk, index) => {
              const angle =
                (index / Math.min(theme.chunks!.length, 8)) * 2 * Math.PI;
              const radius = bubbleSize * 0.8; // Distance from bubble center
              const clipX = Math.cos(angle) * radius;
              const clipY = Math.sin(angle) * radius;

              return (
                <motion.div
                  key={chunk.sentenceId}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: clipX,
                    y: clipY,
                  }}
                  exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: "easeOut",
                    delay: index * 0.1,
                  }}
                  className="absolute z-40 pointer-events-auto"
                  style={{
                    width: "120px",
                    height: "60px",
                  }}
                >
                  <div className="w-full h-full bg-background/95 backdrop-blur-md border border-blue-200/30 rounded-lg p-2 shadow-lg">
                    <div
                      className="text-xs text-foreground/80 overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        lineHeight: "1.2",
                      }}
                    >
                      {chunk.text}
                    </div>
                  </div>

                  {/* Connection line to center bubble */}
                  <div
                    className="absolute w-px bg-blue-300/40"
                    style={{
                      height: `${radius * 0.6}px`,
                      left: "50%",
                      top: "50%",
                      transformOrigin: "top",
                      transform: `rotate(${
                        angle + Math.PI
                      }rad) translateY(-50%)`,
                    }}
                  />
                </motion.div>
              );
            })}

            {/* Show count if more clips exist */}
            {theme.chunks.length > 8 && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                className="absolute top-full mt-4 left-1/2 transform -translate-x-1/2 z-40"
              >
                <div className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border">
                  +{theme.chunks.length - 8} more clips
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
