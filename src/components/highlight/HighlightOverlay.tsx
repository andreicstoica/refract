"use client";

import { useEffect, useMemo, useRef, forwardRef, useCallback } from "react";
import { cn } from "@/lib/helpers";
import type { HighlightRange, SegmentPaintState } from "@/types/highlight";
import { TEXTAREA_CLASSES, TEXT_DISPLAY_STYLES } from "@/lib/constants";
import {
  buildCutPoints,
  createSegments,
  computeSegmentPaintState,
  assignChunkIndices,
} from "@/lib/highlight";
import { gsap } from "gsap";
import { STAGGER_PER_CHUNK } from "@/lib/highlight";
import { useRafScroll } from "@/features/ui/hooks/useRafScroll";

type SegmentSnapshot = {
  paintState: SegmentPaintState[];
  chunkIndex: number[];
  maxChunkIndex: number;
};

const EMPTY_SNAPSHOT: SegmentSnapshot = {
  paintState: [],
  chunkIndex: [],
  maxChunkIndex: -1,
};

function buildSegmentSnapshot(
  text: string,
  referenceRanges: HighlightRange[],
  activeRanges: HighlightRange[]
): SegmentSnapshot {
  const cuts = buildCutPoints(text, referenceRanges);
  const segments = createSegments(cuts);
  const paintState = computeSegmentPaintState(segments, activeRanges);
  const indices = assignChunkIndices(paintState);
  const maxIndex = indices.reduce(
    (acc, idx) => (idx >= 0 && idx > acc ? idx : acc),
    -1
  );

  return { paintState, chunkIndex: indices, maxChunkIndex: maxIndex };
}

type HighlightOverlayProps = {
  text: string;
  activeRanges: HighlightRange[];
  referenceRanges: HighlightRange[];
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  extraTopPaddingPx?: number;
};

/** Minimal paint-only highlight overlay that mirrors the textarea content flow.
 * No interactivity; caller controls visibility/opacity. Designed to be positioned
 * as absolute inset-0 with pointer-events-none.
 */
export const HighlightOverlay = forwardRef<
  HTMLDivElement,
  HighlightOverlayProps
>(function HighlightOverlay(
  {
    text,
    activeRanges,
    referenceRanges,
    className,
    textareaRef,
    extraTopPaddingPx = 0,
  },
  ref
) {
  const { paintState, chunkIndex, maxChunkIndex } = useMemo(
    () => buildSegmentSnapshot(text, referenceRanges, activeRanges),
    [text, referenceRanges, activeRanges]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  const prevSnapshotRef = useRef<SegmentSnapshot | null>(null);

  const prevPaintState =
    prevSnapshotRef.current?.paintState ?? EMPTY_SNAPSHOT.paintState;
  const prevIndex =
    prevSnapshotRef.current?.chunkIndex ?? EMPTY_SNAPSHOT.chunkIndex;

  useEffect(() => {
    if (prefersReduced || !containerRef.current) return;

    const el = containerRef.current;
    const HIGHLIGHT_ANIM_TIME = 0.2;

    for (let i = 0; i < paintState.length; i++) {
      const segment = paintState[i];
      const isActive = Boolean(segment.color);
      const wasActive = Boolean(prevPaintState?.[i]?.color);
      const prevIdx = prevIndex?.[i] ?? -1;
      const exiting = !isActive && wasActive;

      if (isActive === wasActive) continue;

      // Calculate delay with reversed order for exit animations (bottom-up)
      let delay = 0;
      if (isActive) {
        delay = chunkIndex[i] >= 0 ? chunkIndex[i] * STAGGER_PER_CHUNK : 0;
      } else {
        const reversedIdx =
          prevIdx >= 0 && maxChunkIndex >= 0 ? maxChunkIndex - prevIdx : -1;
        delay = reversedIdx >= 0 ? reversedIdx * STAGGER_PER_CHUNK : 0;
      }

      const node = el.querySelector<HTMLElement>(`span[data-segment="${i}"]`);
      if (node) {
        if (isActive) {
          gsap.fromTo(
            node,
            { backgroundSize: "0% 100%", backgroundPosition: "left top" },
            {
              backgroundSize: "100% 100%",
              backgroundPosition: "left top",
              duration: HIGHLIGHT_ANIM_TIME,
              delay: delay.toString(),
              ease: "power2.out",
            }
          );
        } else {
          gsap.fromTo(
            node,
            { backgroundSize: "100% 100%", backgroundPosition: "left top" },
            {
              backgroundSize: "0% 100%",
              backgroundPosition: "left top",
              duration: HIGHLIGHT_ANIM_TIME,
              delay: delay.toString(),
              ease: "power2.out",
            }
          );
        }
      }
    }

    prevSnapshotRef.current = {
      paintState: [...paintState],
      chunkIndex: [...chunkIndex],
      maxChunkIndex,
    };
  }, [
    paintState,
    chunkIndex,
    maxChunkIndex,
    prefersReduced,
    prevPaintState,
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
        "absolute inset-0 pointer-events-none z-15 overflow-visible overlay-container",
        className
      )}
    >
      <div
        ref={contentRef}
        data-highlight-content
        className={cn(
          `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex`,
          "py-6 h-full overlay-content"
        )}
        style={{
          caretColor: "transparent",
          overflowY: "visible",
          overflowX: "visible",
          whiteSpace: "pre-wrap",
          resize: "none",
          ...TEXT_DISPLAY_STYLES.INLINE_STYLES,
          paddingTop: `${24 + extraTopPaddingPx}px`,
          color: "transparent",
        }}
      >
        {paintState.map(({ start, end, color, intensity, themeId }, i) => {
          const str = text.slice(start, end);
          const isActive = Boolean(color);
          const wasActive = Boolean(prevPaintState?.[i]?.color);
          const prevColor = prevPaintState?.[i]?.color ?? null;
          const prevIntensity = prevPaintState?.[i]?.intensity ?? null;
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
                backgroundSize: "100% 100%",
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
});
