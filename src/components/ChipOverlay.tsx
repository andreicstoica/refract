"use client";

import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { calculateHorizontalOffsets } from "@/lib/position";

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
  const positionMap = new Map(sentencePositions.map((pos) => [pos.sentenceId, pos]));
  const horizontalOffsetByProdId = calculateHorizontalOffsets(visibleProds);

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
