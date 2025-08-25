"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/helpers";
import { useRafScroll } from "@/lib/useRafScroll";

interface ChipOverlayProps {
  visibleProds: Prod[];
  sentencePositions: SentencePosition[];
  className?: string;
  onChipFade?: (prodId: string) => void;
  onChipKeep?: (prod: Prod) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  extraTopPaddingPx?: number;
}

export function ChipOverlay({
  visibleProds,
  sentencePositions,
  className,
  onChipFade,
  onChipKeep,
  textareaRef,
  extraTopPaddingPx = 0,
}: ChipOverlayProps) {
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  // Measure container width to enforce left/right boundaries
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState<number>(0);

  useEffect(() => {
    const el = contentRef.current || containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContentWidth(el.clientWidth);
    });
    setContentWidth(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync with textarea scroll position using RAF coalescing for optimal performance
  const handleScrollSync = useCallback((element: HTMLElement) => {
    if (contentRef.current) {
      const textarea = element as HTMLTextAreaElement;
      contentRef.current.style.transform = `translateY(-${textarea.scrollTop}px)`;
    }
  }, []);

  useRafScroll(textareaRef, handleScrollSync);

  // Set initial scroll position
  useEffect(() => {
    if (textareaRef?.current && contentRef.current) {
      const textarea = textareaRef.current;
      contentRef.current.style.transform = `translateY(-${textarea.scrollTop}px)`;
    }
  }, [textareaRef]);

  // End-aligned with clamping; mobile-friendly via CSS --chip-gutter
  const layoutByProdId = useMemo(() => {
    if (contentWidth <= 0)
      return new Map<string, { h: number; v: number; maxWidth?: number }>();

    // Read responsive chip gutter from CSS. On mobile, CSS can override this var.
    const chipGutter =
      typeof window !== "undefined"
        ? parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--chip-gutter"
            )
          ) || 8
        : 8;

    // Content padding used in Chip.tsx left calculation (px-4 => 16)
    const contentLeftPad = 16;
    const rightPad = chipGutter + 8; // small extra for pin/icon space

    const rightLimit = contentWidth - rightPad;
    const rowGap = 20;
    const minChipPx = 120; // can tune for mobile via CSS var if needed

    const result = new Map<
      string,
      { h: number; v: number; maxWidth?: number }
    >();
    const usedPositions = new Set<string>();

    for (const prod of visibleProds) {
      const pos = positionMap.get(prod.sentenceId);
      if (!pos) continue;

      // Estimate width quickly (avoid layout thrash)
      const estW = Math.max(minChipPx, Math.round(prod.text.length * 7.5) + 40);

      // End-align: chip's right edge should match sentence end
      const sentenceEndX = contentLeftPad + pos.left + pos.width;
      let startX = sentenceEndX - estW;

      // Clamp to bounds
      startX = Math.max(contentLeftPad, Math.min(startX, rightLimit - estW));

      const available = rightLimit - startX;
      const needsSecondRow = available < Math.min(minChipPx, estW * 0.7);

      let v = needsSecondRow ? rowGap : 0;
      let h = startX - (pos.left + contentLeftPad);

      // Collision detection: horizontal shift first, then vertical if no room
      let positionKey = `${Math.round(pos.top)}-${Math.round(startX)}-${v}`;
      let horizontalOffset = 0;
      let currentStartX = startX;

      while (usedPositions.has(positionKey)) {
        horizontalOffset += 32;
        currentStartX = startX + horizontalOffset;

        // Check if shifted position would overflow right boundary
        if (currentStartX + estW > rightLimit) {
          // Reset horizontal offset and move to next row
          horizontalOffset = 0;
          currentStartX = startX;
          v += rowGap;
          h = currentStartX - (pos.left + contentLeftPad);
          positionKey = `${Math.round(pos.top)}-${Math.round(
            currentStartX
          )}-${v}`;
          // If this row position is also taken, continue the loop to try next horizontal shift
        } else {
          h = currentStartX - (pos.left + contentLeftPad);
          positionKey = `${Math.round(pos.top)}-${Math.round(
            currentStartX
          )}-${v}`;
        }
      }

      usedPositions.add(positionKey);

      const maxWidth = Math.max(0, rightLimit - currentStartX);
      result.set(prod.id, { h, v, maxWidth });
    }

    return result;
  }, [visibleProds, positionMap, contentWidth]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 pointer-events-none z-20 overflow-hidden overlay-container",
        className
      )}
    >
      {/* Inner content translated to mirror textarea scroll - same approach as HighlightLayer */}
      <div
        ref={contentRef}
        data-chip-content
        className={cn(
          `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex`,
          "py-6 h-full relative overlay-content"
        )}
        style={{
          caretColor: "transparent",
          overflowY: "hidden",
          overflowX: "hidden",
          resize: "none",
          lineHeight: "3.5rem",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          paddingTop: `${24 + extraTopPaddingPx}px`,
          color: "transparent",
        }}
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
              maxWidthPx={(offsets as any).maxWidth}
              onFadeComplete={() => onChipFade?.(prod.id)}
              onKeepChip={() => onChipKeep?.(prod)}
            />
          );
        })}
      </div>
    </div>
  );
}
