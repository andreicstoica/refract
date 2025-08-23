"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  // Measure container width to enforce left/right boundaries
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setContentWidth(el.clientWidth);
    });
    setContentWidth(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Layout constants
  const LEFT_PAD = 16; // matches textarea px-4
  const RIGHT_PAD = 16; // matches textarea px-4
  const GAP_X = 8;

  // Compute per-chip offsets (horizontal + optional vertical rows) within boundaries
  const layoutByProdId = useMemo(() => {
    const map = new Map<string, { h: number; v: number }>();
    if (contentWidth <= 0) return map;

    // Group prods by sentence
    const bySentence = new Map<string, Prod[]>();
    for (const p of visibleProds) {
      const arr = bySentence.get(p.sentenceId) || [];
      arr.push(p);
      bySentence.set(p.sentenceId, arr);
    }

    const rightLimit = contentWidth - RIGHT_PAD;

    for (const [sentenceId, prods] of bySentence.entries()) {
      const pos = positionMap.get(sentenceId);
      if (!pos) continue;

      // Sort by timestamp to keep consistent order
      const list = [...prods].sort((a, b) => a.timestamp - b.timestamp);

      const baseLeft = Math.max(LEFT_PAD, pos.left + LEFT_PAD);

      // Pre-compute total width for one-line layout
      const widths = list.map((p) => Math.max(120, p.text.length * 8) + 40);
      const totalWidth =
        widths.reduce((acc, w) => acc + w, 0) + GAP_X * Math.max(0, widths.length - 1);

      // Shift start left if needed to fit within right edge, but not before LEFT_PAD
      const startX = Math.max(LEFT_PAD, Math.min(baseLeft, rightLimit - totalWidth));

      // Place sequentially on a single row, no overlap
      let cursorX = startX;
      for (let i = 0; i < list.length; i++) {
        const prod = list[i];
        const w = widths[i];
        const absX = cursorX;
        map.set(prod.id, {
          h: absX - (pos.left + LEFT_PAD),
          v: 0,
        });
        cursorX = absX + w + GAP_X;
      }
    }

    return map;
  }, [visibleProds, positionMap, contentWidth]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none z-20 ${className || ""}`}
    >
      {visibleProds.map((prod) => {
        const sentencePosition = positionMap.get(prod.sentenceId);
        if (!sentencePosition) return null;
        const offsets = layoutByProdId.get(prod.id) || { h: 0, v: 0 };

        return (
          <Chip
            key={prod.id}
            text={prod.text}
            position={sentencePosition}
            horizontalOffset={offsets.h}
            verticalOffset={offsets.v}
            onFadeComplete={() => onChipFade?.(prod.id)}
            onKeepChip={() => onChipKeep?.(prod)}
          />
        );
      })}
    </div>
  );
}
