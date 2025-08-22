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
  lineHeightPx?: number; // computed textarea line-height in pixels
}

export function ChipOverlay({
  visibleProds,
  sentencePositions,
  className,
  onChipFade,
  onChipKeep,
  lineHeightPx,
}: ChipOverlayProps) {
  // Memoize position map to avoid recreating on every render
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  // Memoize line height calculation
  const LINE_HEIGHT_PX = useMemo(
    () => Math.max(1, Math.round(lineHeightPx || 56)),
    [lineHeightPx]
  );
  const CHIP_HEIGHT_PX = LINE_HEIGHT_PX;
  const STACK_GAP_PX = 2;

  // Memoize prod positioning calculations - no stacking, just one chip per sentence
  const { prodsWithPos, yOffsetByProdId } = useMemo(() => {
    const prodsWithPos = visibleProds
      .map((p) => ({ prod: p, pos: positionMap.get(p.sentenceId) }))
      .filter(
        (
          x
        ): x is {
          prod: (typeof visibleProds)[number];
          pos: SentencePosition;
        } => Boolean(x.pos)
      )
      .sort((a, b) => a.pos.top - b.pos.top || a.pos.left - b.pos.left);

    // No stacking - just one chip per sentence
    const yOffsetByProdId = new Map<string, number>();
    for (const { prod } of prodsWithPos) {
      yOffsetByProdId.set(prod.id, 0); // No offset, chips appear directly under sentences
    }

    return { prodsWithPos, yOffsetByProdId };
  }, [visibleProds, positionMap]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className || ""}`}
    >
      {visibleProds.map((prod) => {
        const sentencePosition = positionMap.get(prod.sentenceId);
        if (!sentencePosition) return null;

        const offsetY = yOffsetByProdId.get(prod.id) ?? 0;

        return (
          <Chip
            key={prod.id}
            text={prod.text}
            position={sentencePosition}
            offsetY={offsetY}
            onFadeComplete={() => onChipFade?.(prod.id)}
            onKeepChip={() => onChipKeep?.(prod)}
          />
        );
      })}
    </div>
  );
}
