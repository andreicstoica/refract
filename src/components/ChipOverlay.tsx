"use client";

import { Chip } from "./Chip";
import type { Prod } from "@/lib/useProds";
import type { SentencePosition } from "@/lib/positionUtils";

interface ChipOverlayProps {
  prods: Prod[];
  sentencePositions: SentencePosition[];
  className?: string;
}

export function ChipOverlay({
  prods,
  sentencePositions,
  className,
}: ChipOverlayProps) {
  // Create a map for quick sentence position lookup
  const positionMap = new Map(
    sentencePositions.map((pos) => [pos.sentenceId, pos])
  );

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-20 ${className || ""}`}
    >
      {prods.map((prod, index) => {
        const sentencePosition = positionMap.get(prod.sentenceId);
        if (!sentencePosition) return null;

        // Only show the first prod for each sentence
        const isFirstForSentence =
          prods.findIndex((p) => p.sentenceId === prod.sentenceId) === index;
        if (!isFirstForSentence) return null;

        return (
          <Chip key={prod.id} text={prod.text} position={sentencePosition} />
        );
      })}
    </div>
  );
}
