"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import { storage } from "@/services/storage";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { TEXT_DISPLAY_STYLES } from "@/utils/constants";

type ThemeHighlightViewProps = {
  className?: string;
  themes?: Theme[];
};

type HighlightRange = {
  start: number;
  end: number;
  color: string;
  themeId: string;
};

// Render text split into stable segments (no unmount on toggle)
// We precompute cut points using all potential ranges, then animate background fill
// per segment based on whether it's currently highlighted.
function renderTextWithHighlights(
  text: string,
  currentRanges: HighlightRange[],
  allRanges: HighlightRange[]
) {
  // Simpler stagger: animate contiguous highlighted chunks sequentially (top-down)
  // We compute which segments are active, group contiguous active segments into chunks,
  // and apply a small delay per chunk index. This avoids measuring layout and soft wraps.
  // Build stable cut points: 0, text.length, and every start/end from all ranges
  const cutSet = new Set<number>([0, text.length]);
  for (const r of allRanges) {
    cutSet.add(r.start);
    cutSet.add(r.end);
  }
  const cuts = Array.from(cutSet).sort((a, b) => a - b);

  const segments: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    if (end > start) segments.push({ start, end });
  }

  // Helper: find active color for a segment (first matching current range)
  const getActiveColor = (start: number, end: number): string | null => {
    for (const r of currentRanges) {
      if (r.start <= start && r.end >= end) return r.color;
    }
    return null;
  };

  // Determine theme priority (later in selectedThemeIds wins)
  // We pass this in via closure by capturing the order from currentRanges
  // Build theme order map from the order currentRanges appear (grouped by themeId occurrence)
  const themeOrder = new Map<string, number>();
  let order = 0;
  for (const r of currentRanges) {
    if (!themeOrder.has(r.themeId)) themeOrder.set(r.themeId, order++);
  }

  // First pass: compute active color per segment using current ranges
  const segmentMeta = segments.map(({ start, end }) => {
    let color: string | null = null;
    let bestPriority = -1;
    for (const r of currentRanges) {
      if (r.start <= start && r.end >= end) {
        const p = themeOrder.get(r.themeId) ?? -1;
        if (p > bestPriority) {
          bestPriority = p;
          color = r.color;
        }
      }
    }
    return { start, end, color };
  });

  // Second pass: assign a chunk index to contiguous active segments
  const chunkIndex: number[] = new Array(segmentMeta.length).fill(-1);
  let currentChunk = -1;
  for (let i = 0; i < segmentMeta.length; i++) {
    const isActive = Boolean(segmentMeta[i].color);
    if (isActive) {
      if (i === 0 || !segmentMeta[i - 1].color) currentChunk += 1;
      chunkIndex[i] = currentChunk;
    }
  }

  const STAGGER_PER_CHUNK_S = 0.04; // 40ms per contiguous highlighted chunk

  const fragments: React.ReactNode[] = segmentMeta.map(({ start, end, color }, i) => {
    const str = text.slice(start, end);
    const isActive = Boolean(color);
    const delay = isActive && chunkIndex[i] >= 0 ? chunkIndex[i] * STAGGER_PER_CHUNK_S : 0;
    return (
      <motion.span
        key={`${start}-${end}`}
        className="inline"
        style={{
          WebkitBoxDecorationBreak: "clone",
          boxDecorationBreak: "clone",
          ["--hl-color" as any]: color ?? undefined,
          backgroundImage: color
            ? `linear-gradient(0deg, var(--hl-color), var(--hl-color))`
            : undefined,
          backgroundRepeat: "no-repeat",
          display: "inline",
        }}
        initial={false}
        animate={{
          backgroundSize: isActive ? "100% 100%" : "0% 100%",
          backgroundPosition: isActive ? "left top" : "right top",
        }}
        transition={{ duration: isActive ? 0.5 : 0, ease: [0.22, 1, 0.36, 1], delay }}
      >
        {str}
      </motion.span>
    );
  });

  return (
    <div
      className={TEXT_DISPLAY_STYLES.CLASSES}
      style={TEXT_DISPLAY_STYLES.INLINE_STYLES}
    >
      {fragments}
    </div>
  );
}

export function ThemeHighlightView({
  className,
  themes: propThemes,
}: ThemeHighlightViewProps) {
  const router = useRouter();
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [fullText, setFullText] = useState<string>("");
  const [sentences, setSentences] = useState<Sentence[] | null>(null);

  // Load data from storage on mount
  useEffect(() => {
    const storedThemes = propThemes || storage.getThemes();
    const storedText = storage.getText();
    const storedSentences = storage.getSentences();

    if (!storedText || !storedThemes?.length) {
      // Redirect to write page if no data
      router.push("/write");
      return;
    }

    setThemes(storedThemes);
    setFullText(storedText);
    setSentences(storedSentences);
  }, [propThemes, router]);

  // Build sentence lookup map once
  const sentenceMap = useMemo(() => {
    const map = new Map<string, Sentence>();
    if (sentences) {
      for (const sentence of sentences) {
        map.set(sentence.id, sentence);
      }
    }
    return map;
  }, [sentences]);

  // Helper to derive ranges from a theme list
  const rangesFromThemes = (
    themeList: Theme[] | null,
    filterIds?: Set<string>
  ): HighlightRange[] => {
    if (!themeList) return [];
    const ranges: HighlightRange[] = [];
    for (const theme of themeList) {
      if (filterIds && !filterIds.has(theme.id)) continue;
      if (!theme.chunks) continue;
      const color = theme.color ?? "#93c5fd";
      for (const chunk of theme.chunks) {
        const s = sentenceMap.get(chunk.sentenceId);
        if (s) {
          ranges.push({
            start: s.startIndex,
            end: s.endIndex,
            color,
            themeId: theme.id,
          });
        } else {
          const chunkText = chunk.text.trim();
          const index = fullText.indexOf(chunkText);
          if (index !== -1) {
            ranges.push({
              start: index,
              end: index + chunkText.length,
              color,
              themeId: theme.id,
            });
          }
        }
      }
    }
    return ranges.sort((a, b) => a.start - b.start);
  };

  // All possible ranges (stable segmentation)
  const allHighlightableRanges = useMemo(
    () => rangesFromThemes(themes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themes, sentenceMap, fullText]
  );

  // Currently active ranges (selected themes only)
  const highlightRanges = useMemo(() => {
    if (!themes || selectedThemeIds.length === 0) return [];
    return rangesFromThemes(themes, new Set(selectedThemeIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes, selectedThemeIds, sentenceMap, fullText]);

  const toggleTheme = (themeId: string) => {
    setSelectedThemeIds((prev) =>
      prev.includes(themeId)
        ? prev.filter((id) => id !== themeId)
        : [...prev, themeId]
    );
  };

  if (!themes || !fullText) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-64 text-muted-foreground",
          className
        )}
      >
        <div className="text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Static centered container matching write page */}
      <div className="mx-auto max-w-2xl w-full h-full px-4">
        <div className="h-full overflow-hidden flex flex-col min-h-0">
          {/* Removed helper text when no theme is selected */}

          {/* Theme selection buttons */}
          <div className="shrink-0 pb-4 mb-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {themes.map((theme) => {
                const isSelected = selectedThemeIds.includes(theme.id);
                const baseColor = theme.color ?? "#93c5fd";
                const fillPct = isSelected ? 24 : 14; // background tint strength
                const borderPct = isSelected ? 42 : 26; // border tint strength
                return (
                  <Button
                    key={theme.id}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTheme(theme.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-center gap-2 max-w-[220px] border transition-colors",
                      isSelected && "ring-1 ring-offset-0"
                    )}
                    style={{
                      ["--chip-color" as any]: baseColor,
                      background: `color-mix(in srgb, var(--chip-color) ${fillPct}%, transparent)`,
                      borderColor: `color-mix(in srgb, var(--chip-color) ${borderPct}%, transparent)`,
                    }}
                  >
                    <span className="truncate">{theme.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Scrollable text area fills remaining height */}
          <div className="relative flex-1 min-h-0">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {renderTextWithHighlights(
                fullText,
                highlightRanges,
                allHighlightableRanges
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
