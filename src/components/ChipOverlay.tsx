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
}

export function ChipOverlay({
  visibleProds,
  sentencePositions,
  className,
  onChipFade,
  onChipKeep,
  textareaRef,
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

  // Simple horizontal offset calculation - stack chips horizontally
  const layoutByProdId = useMemo(() => {
    if (contentWidth <= 0)
      return new Map<string, { h: number; v: number; maxWidth?: number }>();

    const horizontalOffsetByProdId = new Map<string, number>();
    const chipWidthBySentence = new Map<string, number>();

    // Sort prods by timestamp to ensure consistent ordering
    const sortedProds = [...visibleProds].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    for (const prod of sortedProds) {
      const currentWidth = chipWidthBySentence.get(prod.sentenceId) || 0;

      // Estimate chip width based on text length
      const estimatedWidth = Math.max(120, prod.text.length * 8) + 40;

      horizontalOffsetByProdId.set(prod.id, currentWidth);
      chipWidthBySentence.set(
        prod.sentenceId,
        currentWidth + estimatedWidth + 8
      );
    }

    // Convert to the expected format
    const result = new Map<
      string,
      { h: number; v: number; maxWidth?: number }
    >();
    for (const prod of visibleProds) {
      const horizontalOffset = horizontalOffsetByProdId.get(prod.id) || 0;

      result.set(prod.id, {
        h: horizontalOffset,
        v: 0, // No vertical offset - chips are positioned directly below sentences
        maxWidth: Math.max(120, prod.text.length * 8) + 40,
      });
    }

    return result;
  }, [visibleProds, contentWidth]);

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
          paddingTop: "24px",
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
