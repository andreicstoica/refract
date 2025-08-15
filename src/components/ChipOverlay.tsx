"use client";

import { Chip } from "./Chip";
import type { Prod } from "@/lib/useProds";
import type { SentencePosition } from "@/lib/positionUtils";

interface ChipOverlayProps {
  prods: Prod[];
  sentencePositions: SentencePosition[];
  className?: string;
}

export function ChipOverlay({ prods, sentencePositions, className }: ChipOverlayProps) {
  // For now, show chips at the top instead of using complex positioning
  return (
    <div className={`absolute top-4 left-4 right-4 pointer-events-none z-20 ${className || ""}`}>
      <div className="flex flex-wrap gap-2">
        {prods.map((prod, index) => (
          <div
            key={prod.id}
            className="bg-blue-500/20 border border-blue-500/40 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300 font-medium shadow-lg backdrop-blur-sm"
          >
            {prod.text}
          </div>
        ))}
      </div>
    </div>
  );
}