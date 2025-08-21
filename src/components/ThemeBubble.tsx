"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RefObject } from "react";
import { cn } from "@/lib/helpers";

import type { Theme } from "@/types/theme";
const MotionDiv = motion.div;

interface ThemeBubbleProps {
  theme: Theme;
  position: { x: number; y: number };
  size: number;
  onExpand?: (themeId: string) => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  className?: string;
  expandedScale?: number;
  clipRadiusFactor?: number; // fraction of bubbleSize used for orbit radius
  maxClips?: number; // max number of clip cards to render
  clipCardSize?: { width: number; height: number };
  // Enable auto width for orbit cards (size-to-content) on large screens
  autoClipWidth?: boolean;
  // Estimated width used for spacing math when auto width is enabled
  estimatedClipWidthPx?: number;
  // Optional max width constraint for auto-sized cards
  maxClipWidthPx?: number;
  draggable?: boolean;
  dragConstraintsRef?: RefObject<Element | null>;
  clipTextClassName?: string;
  clipLineClamp?: number;
  listMode?: boolean; // on small screens, show vertical list instead of orbit
  listPanelMaxWidthPx?: number; // max width for list panel on larger screens
  listPanelMaxHeightVH?: number; // max height as a percentage of viewport height
  // Container size to clamp orbit clips on-screen
  containerSize?: { width: number; height: number };
}

export function ThemeBubble(props: ThemeBubbleProps) {
  const {
    theme,
    position,
    size,
    onExpand,
    onCollapse,
    isExpanded = false,
    className,
    expandedScale = 2.5,
    clipRadiusFactor = 0.8,
    maxClips = 8,
    clipCardSize = { width: 120, height: 60 },
    autoClipWidth = false,
    estimatedClipWidthPx = 120,
    maxClipWidthPx = 220,
    draggable = false,
    dragConstraintsRef,
    clipTextClassName = "text-xs",
    clipLineClamp = 3,
    listMode = false,
    listPanelMaxWidthPx = 520,
    listPanelMaxHeightVH = 70,
    containerSize,
  } = props;
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [topClipId, setTopClipId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <MotionDiv
      layout
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: isExpanded ? expandedScale : 1,
        zIndex: isExpanded ? 50 : 10,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        delay: Math.random() * 0.3,
        layout: { type: "spring", stiffness: 300, damping: 28 },
      }}
      drag={isExpanded && draggable}
      dragConstraints={dragConstraintsRef}
      dragElastic={0.12}
      dragMomentum={false}
      whileDrag={{ scale: expandedScale * 0.98 }}
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
      <MotionDiv
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
        <MotionDiv
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
          <MotionDiv
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
          <MotionDiv
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
          </MotionDiv>

          {isHovered && (
            <MotionDiv
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
            </MotionDiv>
          )}
        </div>

        {/* Expansion indicator */}
        {isExpanded && (
          <MotionDiv
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
          />
        )}
      </MotionDiv>

      {/* Sentence clips: orbit (default) or vertical list (mobile) */}
      <AnimatePresence>
        {isExpanded && theme.chunks && (
          <>
            {!listMode &&
              theme.chunks &&
              (() => {
                const chunks = theme.chunks;
                // Base sizing
                const spacingAdjust = 0.75; // tighter spacing so more clips fit
                const estimatedWidth = autoClipWidth
                  ? estimatedClipWidthPx
                  : clipCardSize.width;
                const clipH = clipCardSize.height;
                const minSpacing = (estimatedWidth + 12) * spacingAdjust; // include margin
                const baseRadius = bubbleSize * clipRadiusFactor;
                // Max radius allowed by container bounds (keep clips on-screen)
                let maxRadiusByBounds = Infinity;
                if (containerSize) {
                  const centerX = (position.x / 100) * containerSize.width;
                  const centerY = (position.y / 100) * containerSize.height;
                  const halfDiag = Math.sqrt(
                    Math.pow(estimatedWidth / 2, 2) + Math.pow(clipH / 2, 2)
                  );
                  const distLeft = centerX;
                  const distRight = containerSize.width - centerX;
                  const distTop = centerY;
                  const distBottom = containerSize.height - centerY;
                  maxRadiusByBounds =
                    Math.max(0, Math.min(distLeft, distRight, distTop, distBottom) - halfDiag - 8);
                }

                // Determine how many clips we can fit around a circle of max radius
                const maxClipsByRadius = Number.isFinite(maxRadiusByBounds)
                  ? Math.max(1, Math.floor(((2 * Math.PI) * Math.min(maxRadiusByBounds, Math.max(baseRadius, 0))) / Math.max(minSpacing, 1)))
                  : maxClips;

                const count = Math.min(chunks.length, maxClips, maxClipsByRadius);
                // Compute a workable radius based on final count
                const requiredRadius = (minSpacing * count) / (2 * Math.PI);
                const orbitRadius = Math.min(
                  Number.isFinite(maxRadiusByBounds) ? maxRadiusByBounds : requiredRadius,
                  Math.max(Math.max(baseRadius, requiredRadius), 0)
                );

                const renderChunks = chunks.slice(0, count);
                return renderChunks.map((chunk, index) => {
                  const angle = (index / renderChunks.length) * 2 * Math.PI;
                  const clipX = Math.cos(angle) * orbitRadius;
                  const clipY = Math.sin(angle) * orbitRadius;

                  return (
                    <MotionDiv
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
                      className="absolute pointer-events-auto"
                      style={{
                        zIndex: topClipId === chunk.sentenceId ? 60 : 40,
                        width: autoClipWidth
                          ? "auto"
                          : `${clipCardSize.width}px`,
                        height: "auto",
                        maxWidth: autoClipWidth
                          ? `${maxClipWidthPx}px`
                          : undefined,
                      }}
                      onMouseDown={() => setTopClipId(chunk.sentenceId)}
                    >
                      <div className="w-full h-auto bg-background/95 backdrop-blur-md border border-blue-200/30 rounded-lg p-2 shadow-lg">
                        <div
                          className={cn(
                            clipTextClassName,
                            "text-foreground/80"
                          )}
                          style={{
                            lineHeight: "1.25",
                            whiteSpace: "normal",
                          }}
                        >
                          {chunk.text}
                        </div>
                      </div>

                      {/* Connection line removed for cleaner look */}
                    </MotionDiv>
                  );
                });
              })()}

            {/* Show count if more clips exist (orbit mode) */}
            {/* No "+N more" indicator by design */}

            {/* Vertical list mode (mobile) */}
            {listMode &&
              mounted &&
              createPortal(
                <MotionDiv
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-0"
                >
                  <div
                    className="absolute inset-0 bg-black/20"
                    onClick={() => onCollapse?.()}
                  />
                  <div className="relative w-[100vw] max-w-[100vw] px-0">
                    <div
                      className="relative mx-auto bg-background/95 backdrop-blur-md border border-blue-200/40 rounded-xl shadow-2xl overflow-hidden"
                      style={{
                        width: `min(100vw, ${listPanelMaxWidthPx}px)`,
                        maxWidth: `min(100vw, ${listPanelMaxWidthPx}px)`,
                        maxHeight: `${listPanelMaxHeightVH}vh`,
                      }}
                    >
                      <div
                        className="overflow-y-auto p-2"
                        style={{ maxHeight: `${listPanelMaxHeightVH}vh` }}
                      >
                        {theme.chunks.slice(0, maxClips).map((chunk) => (
                          <div
                            key={chunk.sentenceId}
                            className="p-2 rounded-lg border border-blue-200/30 mb-2 last:mb-0 bg-background/80"
                          >
                            <div
                              className={cn(
                                clipTextClassName,
                                "text-foreground/80"
                              )}
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: clipLineClamp,
                                WebkitBoxOrient: "vertical",
                                lineHeight: "1.25",
                                overflow: "hidden",
                              }}
                            >
                              {chunk.text}
                            </div>
                          </div>
                        ))}
                        {theme.chunks.length > maxClips && (
                          <div className="text-center text-[10px] text-muted-foreground py-1">
                            +{theme.chunks.length - maxClips} more clips
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Bottom-centered close button that overlaps the card edge */}
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => onCollapse?.()}
                      className="absolute left-1/2 bottom-0 translate-x-[-50%] translate-y-[70%] w-10 h-10 rounded-full border border-blue-200/50 bg-background shadow-lg flex items-center justify-center text-[14px] hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                    >
                      ×
                    </button>
                  </div>
                </MotionDiv>,
                document.body
              )}
          </>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
