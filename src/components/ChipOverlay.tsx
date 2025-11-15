"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chip } from "./Chip";
import type { Prod } from "@/types/prod";
import type { Sentence, SentencePosition } from "@/types/sentence";
import { TEXTAREA_CLASSES } from "@/lib/layoutConstants";
import { cn } from "@/lib/helpers";
import { useRafScroll } from "@/features/ui/hooks/useRafScroll";
import { calculateChipLayout } from "@/lib/chipLayout";
import type { ChipPlacement } from "@/lib/chipLayout";
import { debug } from "@/lib/debug";
import {
  useProdActions,
  useProdState,
} from "@/features/prods/context/ProdsProvider";

interface ChipOverlayProps {
  sentencePositions: SentencePosition[];
  sentences?: Sentence[];
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  extraTopPaddingPx?: number;
}

export function ChipOverlay({
  sentencePositions,
  sentences = [],
  className,
  textareaRef,
  extraTopPaddingPx = 0,
}: ChipOverlayProps) {
  const { prods, pinnedIds } = useProdState();
  const { pin, remove } = useProdActions();

  const positionMap = useMemo(
    () => new Map(sentencePositions.map((pos) => [pos.sentenceId, pos])),
    [sentencePositions]
  );

  const findFallback = useCallback(
    (prod: Prod): SentencePosition | undefined => {
      if (!prod.sourceText) {
        debug.warn(
          "🎯 No sourceText for prod:",
          prod.id,
          prod.text.slice(0, 30)
        );
        return undefined;
      }

      // Reconstruct the sentence by walking exact > prefix > substring matches
      const norm = prod.sourceText.trim().toLowerCase();
      let match: Sentence | undefined = undefined;

      match = sentences.find((s) => s.text.trim().toLowerCase() === norm);

      if (!match) {
        const head = norm.slice(0, 50);
        match = sentences.find((s) =>
          s.text.trim().toLowerCase().startsWith(head)
        );
      }

      if (!match && norm.length > 10) {
        const searchTerm = norm.slice(0, Math.min(30, norm.length));
        match = sentences.find((s) =>
          s.text.toLowerCase().includes(searchTerm)
        );
      }

      if (match) {
        debug.dev("🎯 Fallback match found:", {
          prodText: prod.text.slice(0, 30),
          sourceText: prod.sourceText.slice(0, 30),
          matchedSentence: match.text.slice(0, 30),
        });
      } else {
        debug.warn("🎯 No fallback match found for:", {
          prodText: prod.text.slice(0, 30),
          sourceText: prod.sourceText.slice(0, 30),
          availableSentences: sentences.map((s) => s.text.slice(0, 20)),
        });
      }

      if (!match) return undefined;
      return positionMap.get(match.id);
    },
    [sentences, positionMap]
  );

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

  const handleScrollSync = useCallback((element: HTMLElement) => {
    if (contentRef.current) {
      const textarea = element as HTMLTextAreaElement;
      contentRef.current.style.transform = `translateY(-${textarea.scrollTop}px)`;
    }
  }, []);

  useRafScroll(textareaRef, handleScrollSync);

  useEffect(() => {
    if (textareaRef?.current && contentRef.current) {
      const textarea = textareaRef.current;
      contentRef.current.style.transform = `translateY(-${textarea.scrollTop}px)`;
    }
  }, [textareaRef]);

  const previousLayoutRef = useRef<Map<string, ChipPlacement>>(new Map());
  const previousLayout = previousLayoutRef.current;

  const layoutByProdId = useMemo(() => {
    if (contentWidth <= 0) return new Map<string, ChipPlacement>();

    return calculateChipLayout(
      prods,
      positionMap,
      contentWidth,
      pinnedIds,
      previousLayout
    );
  }, [prods, positionMap, contentWidth, pinnedIds, previousLayout]);

  useEffect(() => {
    previousLayoutRef.current = new Map(layoutByProdId);
  }, [layoutByProdId]);

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
        {prods.map((prod) => {
          const sentencePosition =
            positionMap.get(prod.sentenceId) || findFallback(prod);
          if (!sentencePosition) {
            debug.warn("🎯 No sentence position found for prod:", {
              prodId: prod.id,
              sentenceId: prod.sentenceId,
              prodText: prod.text.slice(0, 30) + "...",
              sourceText: prod.sourceText?.slice(0, 30) + "...",
            });
            return null;
          }
          const offsets = layoutByProdId.get(prod.id);

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
              onFadeComplete={() => remove(prod.id)}
              onKeepChip={() => pin(prod.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
