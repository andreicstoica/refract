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
  // Create a map for quick sentence position lookup
  const positionMap = new Map(
    sentencePositions.map((pos) => [pos.sentenceId, pos])
  );

  // Collision avoidance using consistent line height
  // Use the actual computed textarea line-height when available
  const LINE_HEIGHT_PX = Math.max(1, Math.round(lineHeightPx || 56));
  const CHIP_HEIGHT_PX = LINE_HEIGHT_PX; // Use same line height as text
  const STACK_GAP_PX = 0; // No gap needed with proper line height

  // Prepare list with positions and sort by top/left for stable stacking
  const prodsWithPos = visibleProds
    .map((p) => ({ prod: p, pos: positionMap.get(p.sentenceId) }))
    .filter((x): x is { prod: typeof visibleProds[number]; pos: SentencePosition } => Boolean(x.pos))
    .sort((a, b) => (a.pos.top - b.pos.top) || (a.pos.left - b.pos.left));

  const lineStackCounts = new Map<number, number>();
  const yOffsetByProdId = new Map<string, number>();

  for (const { prod, pos } of prodsWithPos) {
    const lineIndex = Math.round(pos.top / LINE_HEIGHT_PX);
    const currentStack = lineStackCounts.get(lineIndex) ?? 0;
    const extraY = currentStack * (CHIP_HEIGHT_PX + STACK_GAP_PX);
    yOffsetByProdId.set(prod.id, extraY);
    lineStackCounts.set(lineIndex, currentStack + 1);
  }

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
