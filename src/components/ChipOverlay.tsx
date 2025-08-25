"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { computeChipLayout } from "@/lib/chipLayout";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/helpers";

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

  // Optimized scroll sync with throttling to prevent lag
  useEffect(() => {
    if (!textareaRef?.current || !contentRef.current) return;

    const textarea = textareaRef.current;
    const content = contentRef.current;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return; // Skip if animation frame already scheduled
      
      rafId = requestAnimationFrame(() => {
        if (content && textarea) {
          content.style.transform = `translate3d(0, -${textarea.scrollTop}px, 0)`; // Use translate3d for better performance
        }
        rafId = null;
      });
    };

    // Set initial scroll position
    handleScroll();

    textarea.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      textarea.removeEventListener("scroll", handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [textareaRef]);

  // Compute per-chip offsets via layout engine (boundary-safe + collision-free)
  const layoutByProdId = useMemo(() => {
    if (contentWidth <= 0)
      return new Map<string, { h: number; v: number; maxWidth?: number }>();

    // Mobile-optimized boundary calculations
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const bounds = {
      containerWidth: contentWidth,
      leftPad: 0,
      rightPad: isMobile ? 8 : 16, // Smaller right padding on mobile
      gapX: isMobile ? 4 : 8, // Tighter horizontal spacing on mobile
      rowGap: isMobile ? 16 : 20, // Slightly tighter vertical spacing on mobile
      maxRowsPerSentence: isMobile ? 2 : 3, // Fewer rows on mobile to prevent crowding
    } as const;

    return computeChipLayout(visibleProds, positionMap, bounds);
  }, [visibleProds, positionMap, contentWidth]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 pointer-events-none z-20 overflow-hidden",
        className
      )}
    >
      {/* Inner content translated to mirror textarea scroll - same approach as HighlightLayer */}
      <div
        ref={contentRef}
        data-chip-content
        className={cn(
          `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex`,
          "py-6 h-full relative"
        )}
        style={{
          caretColor: "transparent",
          overflowY: "hidden",
          overflowX: "hidden",
          resize: "none",
          lineHeight: "3.5rem", // Match TextInput line height
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
