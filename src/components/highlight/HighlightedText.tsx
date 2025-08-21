"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { HighlightRange } from "@/types/highlight";
import { TEXT_DISPLAY_STYLES } from "@/lib/constants";
import {
  buildCutPoints,
  createSegments,
  computeSegmentMeta,
  assignChunkIndices,
  STAGGER_PER_CHUNK_S,
} from "@/lib/highlight";

type HighlightedTextProps = {
  text: string;
  currentRanges: HighlightRange[];
  allRanges: HighlightRange[];
};

/**
 * Renders text split into stable segments with animated highlights
 * We precompute cut points using all potential ranges, then animate background fill
 * per segment based on whether it's currently highlighted.
 */
export function HighlightedText({
  text,
  currentRanges,
  allRanges,
}: HighlightedTextProps) {
  // Build stable cut points: 0, text.length, and every start/end from all ranges
  const cuts = buildCutPoints(text, allRanges);
  const segments = createSegments(cuts);

  // Compute segment metadata with colors and intensities
  const segmentMeta = computeSegmentMeta(segments, currentRanges);

  // Assign chunk indices for staggered animation
  const chunkIndex = assignChunkIndices(segmentMeta);

  // Track previous segment activity and chunk indices to animate exit with reverse stagger
  const prevRef = useRef<{
    meta: ReturnType<typeof computeSegmentMeta> | null;
    chunkIndex: number[] | null;
  }>({ meta: null, chunkIndex: null });

  // Determine reverse-stagger baseline for exiting segments (bottom-up / end-to-start)
  const prevMeta = prevRef.current.meta;
  const prevIndex = prevRef.current.chunkIndex;
  let maxPrevExitingIdx = -1;
  if (prevMeta && prevIndex) {
    for (let i = 0; i < segmentMeta.length; i++) {
      const wasActive = Boolean(prevMeta[i]?.color);
      const isActive = Boolean(segmentMeta[i]?.color);
      if (wasActive && !isActive) {
        const p = prevIndex[i] ?? -1;
        if (p > maxPrevExitingIdx) maxPrevExitingIdx = p;
      }
    }
  }

  const fragments: React.ReactNode[] = segmentMeta.map(
    ({ start, end, color, intensity }, i) => {
      const str = text.slice(start, end);
      const isActive = Boolean(color);
      const wasActive = Boolean(prevRef.current.meta?.[i]?.color);
      const prevColor = prevRef.current.meta?.[i]?.color ?? null;
      const prevIntensity = prevRef.current.meta?.[i]?.intensity ?? null;
      const prevIdx = prevRef.current.chunkIndex?.[i] ?? -1;
      const exiting = !isActive && wasActive;

      const delay = isActive
        ? chunkIndex[i] >= 0
          ? chunkIndex[i] * STAGGER_PER_CHUNK_S
          : 0
        : exiting && prevIdx >= 0
          ? (maxPrevExitingIdx >= 0
              ? (maxPrevExitingIdx - prevIdx) * STAGGER_PER_CHUNK_S
              : prevIdx * STAGGER_PER_CHUNK_S)
          : 0;

      // Choose display color/intensity: keep previous values during exit so it can animate out
      const displayColor = isActive ? color : exiting ? prevColor : null;
      const displayIntensity = isActive ? intensity : exiting ? prevIntensity : null;

      // Map intensity (0-1) to opacity range (0.2-0.7) for balanced contrast
      const opacity = displayIntensity != null
        ? Math.max(0.2, Math.min(0.7, 0.2 + (displayIntensity * 0.5)))
        : undefined;

      return (
        <motion.span
          key={`${start}-${end}`}
          className="inline"
          style={{
            WebkitBoxDecorationBreak: "clone",
            boxDecorationBreak: "clone",
            ["--hl-color" as any]: displayColor ?? undefined,
            backgroundImage: displayColor && opacity != null
              ? `linear-gradient(0deg, color-mix(in srgb, var(--hl-color) ${Math.round(opacity * 100)}%, transparent), color-mix(in srgb, var(--hl-color) ${Math.round(opacity * 100)}%, transparent))`
              : undefined,
            backgroundRepeat: "no-repeat",
            display: "inline",
          }}
          initial={false}
          animate={{
            backgroundSize: isActive ? "100% 100%" : "0% 100%",
            // Enter: left->right. Exit: right->left (anchor left). Otherwise default right.
            backgroundPosition: isActive
              ? "left top"
              : exiting
                ? "left top"
                : "right top",
          }}
          transition={{
            duration: isActive ? 0.4 : exiting ? 0.36 : 0,
            ease: [0.22, 1, 0.36, 1],
            delay,
          }}
        >
          {str}
        </motion.span>
      );
    }
  );

  // After rendering, store current meta/index for exit animations on next change
  useEffect(() => {
    prevRef.current = { meta: segmentMeta, chunkIndex };
  }, [segmentMeta, chunkIndex]);

  return (
    <div
      className={TEXT_DISPLAY_STYLES.CLASSES}
      style={TEXT_DISPLAY_STYLES.INLINE_STYLES}
    >
      {fragments}
    </div>
  );
}
