"use client";

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
  // Create a map for quick sentence position lookup
  const positionMap = new Map(
    sentencePositions.map((pos) => [pos.sentenceId, pos])
  );

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className || ""}`}
    >
      {visibleProds.map((prod) => {
        const sentencePosition = positionMap.get(prod.sentenceId);
        if (!sentencePosition) return null;

        return (
          <Chip
            key={prod.id}
            text={prod.text}
            position={sentencePosition}
            onFadeComplete={() => onChipFade?.(prod.id)}
            onKeepChip={() => onChipKeep?.(prod)}
          />
        );
      })}
    </div>
  );
}
