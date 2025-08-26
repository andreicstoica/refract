"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { Sentence, SentencePosition } from "@/types/sentence";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/helpers";
import { useRafScroll } from "@/hooks/useRafScroll";
import { calculateChipLayout } from "@/services/chipLayoutService";

interface ChipOverlayProps {
  visibleProds: Prod[];
  sentencePositions: SentencePosition[];
  sentences?: Sentence[];
  className?: string;
  onChipFade?: (prodId: string) => void;
  onChipKeep?: (prod: Prod) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  extraTopPaddingPx?: number;
  pinnedProdIds?: Set<string>;
}

export function ChipOverlay({
  visibleProds,
  sentencePositions,
  sentences = [],
  className,
  onChipFade,
  onChipKeep,
  textareaRef,
  extraTopPaddingPx = 0,
  pinnedProdIds = new Set(),
}: ChipOverlayProps) {
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  const findFallbackPosition = useCallback(
    (prod: Prod): SentencePosition | undefined => {
      if (!prod.sourceText) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "🎯 No sourceText for prod:",
            prod.id,
            prod.text.slice(0, 30)
          );
        }
        return undefined;
      }

      // Try to find a sentence with matching text if ID lookup failed
      const norm = prod.sourceText.trim().toLowerCase();
      let match: Sentence | undefined = undefined;

      // Exact match first
      match = sentences.find((s) => s.text.trim().toLowerCase() === norm);

      if (!match) {
        // Prefix match (first 50 chars for better matching)
        const head = norm.slice(0, 50);
        match = sentences.find((s) =>
          s.text.trim().toLowerCase().startsWith(head)
        );
      }

      if (!match && norm.length > 10) {
        // Substring match as last resort, but only for longer text
        const searchTerm = norm.slice(0, Math.min(30, norm.length));
        match = sentences.find((s) =>
          s.text.toLowerCase().includes(searchTerm)
        );
      }

      if (process.env.NODE_ENV !== "production") {
        if (match) {
          console.log("🎯 Fallback match found:", {
            prodText: prod.text.slice(0, 30),
            sourceText: prod.sourceText.slice(0, 30),
            matchedSentence: match.text.slice(0, 30),
          });
        } else {
          console.warn("🎯 No fallback match found for:", {
            prodText: prod.text.slice(0, 30),
            sourceText: prod.sourceText.slice(0, 30),
            availableSentences: sentences.map((s) => s.text.slice(0, 20)),
          });
        }
      }

      if (!match) return undefined;
      return positionMap.get(match.id);
    },
    [sentences, positionMap]
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

  // Sentence-aware chip layout with overflow handling
  const layoutByProdId = useMemo(() => {
    if (contentWidth <= 0) return new Map();

    return calculateChipLayout(
      visibleProds,
      positionMap,
      contentWidth,
      pinnedProdIds
    );
  }, [visibleProds, positionMap, contentWidth, pinnedProdIds]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 pointer-events-none z-20 overflow-hidden overlay-container",
        className
      )}
    >
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
          whiteSpace: "pre-wrap",
          resize: "none",
          lineHeight: "3.5rem",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          paddingTop: `${24 + extraTopPaddingPx}px`,
          color: "transparent",
        }}
      >
        {visibleProds.map((prod) => {
          const sentencePosition =
            positionMap.get(prod.sentenceId) || findFallbackPosition(prod);
          if (!sentencePosition) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("🎯 No sentence position found for prod:", {
                prodId: prod.id,
                sentenceId: prod.sentenceId,
                prodText: prod.text.slice(0, 30) + "...",
                sourceText: prod.sourceText?.slice(0, 30) + "...",
              });
            }
            return null;
          }
          const offsets = layoutByProdId.get(prod.id);

          // Skip rendering if chip was filtered out by layout system
          if (!offsets) {
            return null;
          }

          return (
            <Chip
              key={prod.id}
              text={prod.text}
              position={sentencePosition}
              horizontalOffset={offsets.h}
              verticalOffset={offsets.v}
              maxWidthPx={offsets.maxWidth}
              containerWidth={contentWidth}
              onFadeComplete={() => onChipFade?.(prod.id)}
              onKeepChip={() => onChipKeep?.(prod)}
            />
          );
        })}
      </div>
    </div>
  );
}
