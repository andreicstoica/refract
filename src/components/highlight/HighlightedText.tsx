"use client";

import { motion } from "framer-motion";
import type { HighlightRange } from "@/types/highlight";
import { TEXT_DISPLAY_STYLES } from "@/utils/constants";
import {
  buildCutPoints,
  createSegments,
  buildThemeOrder,
  computeSegmentMeta,
  assignChunkIndices,
  STAGGER_PER_CHUNK_S,
} from "@/utils/highlightUtils";

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

  // Build theme priority order map
  const themeOrder = buildThemeOrder(currentRanges);

  // Compute segment metadata with colors and priorities
  const segmentMeta = computeSegmentMeta(segments, currentRanges, themeOrder);

  // Assign chunk indices for staggered animation
  const chunkIndex = assignChunkIndices(segmentMeta);

  const fragments: React.ReactNode[] = segmentMeta.map(
    ({ start, end, color }, i) => {
      const str = text.slice(start, end);
      const isActive = Boolean(color);
      const delay =
        isActive && chunkIndex[i] >= 0
          ? chunkIndex[i] * STAGGER_PER_CHUNK_S
          : 0;

      return (
        <motion.span
          key={`${start}-${end}`}
          className="inline"
          style={{
            WebkitBoxDecorationBreak: "clone",
            boxDecorationBreak: "clone",
            ["--hl-color" as any]: color ?? undefined,
            backgroundImage: color
              ? `linear-gradient(0deg, var(--hl-color), var(--hl-color))`
              : undefined,
            backgroundRepeat: "no-repeat",
            display: "inline",
          }}
          initial={false}
          animate={{
            backgroundSize: isActive ? "100% 100%" : "0% 100%",
            backgroundPosition: isActive ? "left top" : "right top",
          }}
          transition={{
            duration: isActive ? 0.5 : 0,
            ease: [0.22, 1, 0.36, 1],
            delay,
          }}
        >
          {str}
        </motion.span>
      );
    }
  );

  return (
    <div
      className={TEXT_DISPLAY_STYLES.CLASSES}
      style={TEXT_DISPLAY_STYLES.INLINE_STYLES}
    >
      {fragments}
    </div>
  );
}
