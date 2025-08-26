"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { Sentence, SentencePosition } from "@/types/sentence";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import { cn } from "@/lib/helpers";
import { useRafScroll } from "@/lib/useRafScroll";

interface ChipOverlayProps {
  visibleProds: Prod[];
  sentencePositions: SentencePosition[];
  sentences?: Sentence[];
  className?: string;
  onChipFade?: (prodId: string) => void;
  onChipKeep?: (prod: Prod) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  extraTopPaddingPx?: number;
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
}: ChipOverlayProps) {
  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  const sentencesById = useMemo(() => {
    const map = new Map<string, Sentence>();
    for (const s of sentences) map.set(s.id, s);
    return map;
  }, [sentences]);

  const findFallbackPosition = useCallback((prod: Prod): SentencePosition | undefined => {
    if (!prod.sourceText) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("🎯 No sourceText for prod:", prod.id, prod.text.slice(0, 30));
      }
      return undefined;
    }
    
    // Try to find a sentence with matching text if ID lookup failed
    const norm = prod.sourceText.trim().toLowerCase();
    let match: Sentence | undefined = undefined;
    
    // Exact match first
    match = sentences.find(s => s.text.trim().toLowerCase() === norm);
    
    if (!match) {
      // Prefix match (first 50 chars for better matching)
      const head = norm.slice(0, 50);
      match = sentences.find(s => s.text.trim().toLowerCase().startsWith(head));
    }
    
    if (!match && norm.length > 10) {
      // Substring match as last resort, but only for longer text
      const searchTerm = norm.slice(0, Math.min(30, norm.length));
      match = sentences.find(s => s.text.toLowerCase().includes(searchTerm));
    }
    
    if (process.env.NODE_ENV !== "production") {
      if (match) {
        console.log("🎯 Fallback match found:", {
          prodText: prod.text.slice(0, 30),
          sourceText: prod.sourceText.slice(0, 30),
          matchedSentence: match.text.slice(0, 30)
        });
      } else {
        console.warn("🎯 No fallback match found for:", {
          prodText: prod.text.slice(0, 30),
          sourceText: prod.sourceText.slice(0, 30),
          availableSentences: sentences.map(s => s.text.slice(0, 20))
        });
      }
    }
    
    if (!match) return undefined;
    return positionMap.get(match.id);
  }, [sentences, positionMap]);

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
    
    // Sort prods by timestamp to ensure consistent positioning order
    const sortedProds = [...visibleProds].sort((a, b) => a.timestamp - b.timestamp);

    for (const prod of sortedProds) {
      const pos = positionMap.get(prod.sentenceId);
      if (!pos) {
        if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_CHIPS === '1') {
          console.warn("🎯 No position found for sentence ID:", prod.sentenceId, "prod:", prod.text.slice(0, 30));
          console.log("🎯 Available positions:", Array.from(positionMap.keys()));
        }
        continue;
      }

      // Estimate width quickly (avoid layout thrash)
      const estW = Math.max(minChipPx, Math.round(prod.text.length * 7.5) + 40);

      // Flexible positioning: allow chips anywhere within the sentence bounds
      const sentenceStartX = contentLeftPad + pos.left;
      const sentenceEndX = contentLeftPad + pos.left + pos.width;
      const sentenceWidth = sentenceEndX - sentenceStartX;
      
      // Position chips toward the end of sentences with some variation
      const timeVariation = (prod.timestamp % 200) / 200; // 0-1 range
      const positionRatio = 0.7 + (timeVariation * 0.25); // 70%-95% toward end of sentence
      
      let startX = sentenceStartX + (sentenceWidth * positionRatio) - (estW / 2);
      
      // Ensure chip fits within sentence bounds and screen bounds
      startX = Math.max(sentenceStartX, Math.min(startX, sentenceEndX - estW));
      startX = Math.max(contentLeftPad, Math.min(startX, rightLimit - estW));

      const available = rightLimit - startX;
      const needsSecondRow = available < Math.min(minChipPx, estW * 0.7);

      let v = needsSecondRow ? rowGap : 0;
      let h = startX - (pos.left + contentLeftPad);
      
      // Stagger multiple prods on same sentence
      const prodsOnSentence = sortedProds.filter(p => p.sentenceId === prod.sentenceId);
      const prodIndex = prodsOnSentence.indexOf(prod);
      if (prodIndex > 0) {
        h += prodIndex * 16; // Horizontal stagger
        v += prodIndex * 8;  // Vertical stagger
      }

      // Better collision detection with multiple attempts
      let currentStartX = startX;
      let attempts = 0;
      const maxAttempts = 6;
      let positionKey = `${Math.round(pos.top)}-${Math.round(currentStartX)}-${v}`;
      
      // Try to find a position that doesn't collide
      while (usedPositions.has(positionKey) && attempts < maxAttempts) {
        if (attempts < 3) {
          // Try shifting horizontally within sentence bounds
          const shift = (attempts + 1) * 24;
          currentStartX = startX + shift;
          if (currentStartX + estW > sentenceEndX) {
            currentStartX = Math.max(sentenceStartX, startX - shift);
          }
        } else {
          // Move to next row
          currentStartX = startX;
          v += rowGap;
        }
        positionKey = `${Math.round(pos.top)}-${Math.round(currentStartX)}-${v}`;
        attempts++;
      }
      
      // Final bounds check
      currentStartX = Math.max(sentenceStartX, Math.min(currentStartX, sentenceEndX - estW));
      currentStartX = Math.max(contentLeftPad, Math.min(currentStartX, rightLimit - estW));

      // Update h for final position
      h = currentStartX - (pos.left + contentLeftPad);

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
          const sentencePosition = positionMap.get(prod.sentenceId) || findFallbackPosition(prod);
          if (!sentencePosition) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("🎯 No sentence position found for prod:", {
                prodId: prod.id,
                sentenceId: prod.sentenceId,
                prodText: prod.text.slice(0, 30) + "...",
                sourceText: prod.sourceText?.slice(0, 30) + "..."
              });
            }
            return null;
          }
          const offsets = layoutByProdId.get(prod.id) || { h: 0, v: 0 };
          
          if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_CHIPS === '1') {
            console.log("🎯 Rendering chip:", {
              prodText: prod.text.slice(0, 20) + "...",
              sentenceId: prod.sentenceId,
              position: { top: sentencePosition.top, left: sentencePosition.left, width: sentencePosition.width },
              offsets: { h: offsets.h, v: offsets.v }
            });
          }

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
