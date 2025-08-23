"use client";

import { useMemo } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";

interface ChipOverlayProps {
  visibleProds: Prod[];
  sentencePositions: SentencePosition[];
  className?: string;
  onChipFade?: (prodId: string) => void;
  onChipKeep?: (prod: Prod) => void;
}

export function ChipOverlay({
  visibleProds,
  sentencePositions,
  className,
  onChipFade,
  onChipKeep,
}: ChipOverlayProps) {
  // Memoize position map to avoid recreating on every render
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  // Memoize prod positioning calculations - side by side layout
  const { prodsWithPos, horizontalOffsetByProdId } = useMemo(() => {
    const prodsWithPos = visibleProds
      .map((p) => ({ prod: p, pos: positionMap.get(p.sentenceId) }))
      .filter(
        (
          x
        ): x is {
          prod: (typeof visibleProds)[number];
          pos: SentencePosition;
        } => Boolean(x.pos)
      );

    // Calculate horizontal offsets for side-by-side layout
    const horizontalOffsetByProdId = new Map<string, number>();
    const chipsPerSentence = new Map<
      string,
      { count: number; totalWidth: number }
    >();

    for (const { prod } of prodsWithPos) {
      const sentenceData = chipsPerSentence.get(prod.sentenceId) || {
        count: 0,
        totalWidth: 0,
      };

      // Estimate chip width based on text length (rough approximation)
      const estimatedWidth = Math.max(120, prod.text.length * 8) + 40; // Base width + text width + padding

      horizontalOffsetByProdId.set(prod.id, sentenceData.totalWidth);
      chipsPerSentence.set(prod.sentenceId, {
        count: sentenceData.count + 1,
        totalWidth: sentenceData.totalWidth + estimatedWidth + 8, // Add 8px gap between chips
      });
    }

    return { prodsWithPos, horizontalOffsetByProdId };
  }, [visibleProds, positionMap]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className || ""}`}
    >
      {visibleProds.map((prod) => {
        const sentencePosition = positionMap.get(prod.sentenceId);
        if (!sentencePosition) return null;

        const horizontalOffset = horizontalOffsetByProdId.get(prod.id) ?? 0;

        return (
          <Chip
            key={prod.id}
            text={prod.text}
            position={sentencePosition}
            horizontalOffset={horizontalOffset}
            onFadeComplete={() => onChipFade?.(prod.id)}
            onKeepChip={() => onChipKeep?.(prod)}
          />
        );
      })}
    </div>
  );
}
