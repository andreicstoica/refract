"use client";

import { useEffect, useMemo, useRef, forwardRef, useCallback } from "react";
import { cn } from "@/lib/helpers";
import type { HighlightRange } from "@/types/highlight";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import {
  buildCutPoints,
  createSegments,
  computeSegmentMeta,
  assignChunkIndices,
} from "@/lib/highlight";
import { gsap } from "gsap";
import { useRafScroll } from "@/lib/useRafScroll";

type HighlightLayerProps = {
  text: string;
  currentRanges: HighlightRange[];
  allRanges: HighlightRange[];
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  extraTopPaddingPx?: number;
};

// Minimal paint-only highlight overlay that mirrors the textarea content flow.
// No interactivity; caller controls visibility/opacity. Designed to be positioned
// as absolute inset-0 with pointer-events-none.
export const HighlightLayer = forwardRef<HTMLDivElement, HighlightLayerProps>(
  function HighlightLayer(
    {
      text,
      currentRanges,
      allRanges,
      className,
      textareaRef,
      extraTopPaddingPx = 0,
    },
    ref
  ) {
    const cuts = useMemo(
      () => buildCutPoints(text, allRanges),
      [text, allRanges]
    );
    const segments = useMemo(() => createSegments(cuts), [cuts]);
    const meta = useMemo(
      () => computeSegmentMeta(segments, currentRanges),
      [segments, currentRanges]
    );
    const chunkIndex = useMemo(() => assignChunkIndices(meta), [meta]);

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    // Track previous segment metadata for exit animations with reverse stagger
    const prevRef = useRef<{
      meta: typeof meta | null;
      chunkIndex: number[] | null;
    }>({ meta: null, chunkIndex: null });

    // Determine reverse-stagger baseline for exiting segments (matching TextWithHighlights)
    const prevMeta = prevRef.current.meta;
    const prevIndex = prevRef.current.chunkIndex;
    let maxPrevExitingIdx = -1;
    if (prevMeta && prevIndex) {
      for (let i = 0; i < meta.length; i++) {
        const wasActive = Boolean(prevMeta[i]?.color);
        const isActive = Boolean(meta[i]?.color);
        if (wasActive && !isActive) {
          const p = prevIndex[i] ?? -1;
          if (p > maxPrevExitingIdx) maxPrevExitingIdx = p;
        }
      }
    }

    // Animate highlights with exact same logic as TextWithHighlights
    useEffect(() => {
      if (prefersReduced || !containerRef.current) return;

      const el = containerRef.current;
      const HIGHLIGHT_ANIM_TIME = 0.2;
      const STAGGER_PER_CHUNK = 0.03;

      // Animate each segment based on its state change
      for (let i = 0; i < meta.length; i++) {
        const segment = meta[i];
        const isActive = Boolean(segment.color);
        const wasActive = Boolean(prevMeta?.[i]?.color);
        const prevIdx = prevIndex?.[i] ?? -1;
        const exiting = !isActive && wasActive;

        // Skip if no state change
        if (isActive === wasActive) continue;

        const delay = isActive
          ? chunkIndex[i] >= 0
            ? chunkIndex[i] * STAGGER_PER_CHUNK
            : 0
          : exiting && prevIdx >= 0
          ? maxPrevExitingIdx >= 0
            ? (maxPrevExitingIdx - prevIdx) * STAGGER_PER_CHUNK
            : prevIdx * STAGGER_PER_CHUNK
          : 0;

        // Find the corresponding DOM node
        const node = el.querySelector<HTMLElement>(`span[data-segment="${i}"]`);
        if (node) {
          gsap.fromTo(
            node,
            {
              backgroundSize: isActive ? "0% 100%" : "100% 100%",
              backgroundPosition: "left top",
            },
            {
              backgroundSize: isActive ? "100% 100%" : "0% 100%",
              backgroundPosition: "left top",
              duration: HIGHLIGHT_ANIM_TIME,
              delay: delay.toString(),
              ease: "power2.out",
            }
          );
        }
      }

      // Update ref for next comparison (matching TextWithHighlights)
      prevRef.current = { meta: [...meta], chunkIndex: [...chunkIndex] };
    }, [
      meta,
      chunkIndex,
      prefersReduced,
      maxPrevExitingIdx,
      prevMeta,
      prevIndex,
    ]);

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (ref) {
            if (typeof ref === "function") {
              ref(node);
            } else {
              ref.current = node;
            }
          }
        }}
        className={cn(
          // Ensure the overlay sits above the textarea (which uses z-10)
          "absolute inset-0 pointer-events-none z-20 overflow-hidden overlay-container",
          className
        )}
      >
        {/* Inner content translated to mirror textarea scroll */}
        <div
          ref={contentRef}
          data-highlight-content
          className={cn(
            `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex`,
            "py-6 h-full overlay-content"
          )}
          style={{
            caretColor: "transparent",
            overflowY: "hidden",
            overflowX: "hidden",
            whiteSpace: "pre-wrap",
            resize: "none",
            lineHeight: "3.5rem",
            fontSize: "1rem",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            paddingTop: `${24 + extraTopPaddingPx}px`,
            color: "transparent",
          }}
        >
          {meta.map(({ start, end, color, intensity, themeId }, i) => {
            const str = text.slice(start, end);
            const isActive = Boolean(color);
            const wasActive = Boolean(prevMeta?.[i]?.color);
            const prevColor = prevMeta?.[i]?.color ?? null;
            const prevIntensity = prevMeta?.[i]?.intensity ?? null;
            const exiting = !isActive && wasActive;

            // Choose display color/intensity: keep previous values during exit so it can animate out
            const displayColor = isActive ? color : exiting ? prevColor : null;
            const displayIntensity = isActive
              ? intensity
              : exiting
              ? prevIntensity
              : null;

            const opacity =
              displayIntensity != null
                ? Math.max(0.2, Math.min(0.7, 0.2 + displayIntensity * 0.5))
                : undefined;

            return (
              <span
                key={`${start}-${end}`}
                className="inline"
                style={{
                  WebkitBoxDecorationBreak: "clone",
                  boxDecorationBreak: "clone",
                  ["--hl-color" as any]: displayColor ?? undefined,
                  backgroundImage:
                    displayColor && opacity != null
                      ? `linear-gradient(0deg, color-mix(in srgb, var(--hl-color) ${Math.round(
                          opacity * 100
                        )}%, transparent), color-mix(in srgb, var(--hl-color) ${Math.round(
                          opacity * 100
                        )}%, transparent))`
                      : undefined,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "left top",
                  display: "inline",
                }}
                data-active={isActive ? "1" : "0"}
                data-chunk={chunkIndex[i] >= 0 ? chunkIndex[i] : undefined}
                data-theme-id={themeId ?? undefined}
                data-segment={i}
              >
                {str}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
);
