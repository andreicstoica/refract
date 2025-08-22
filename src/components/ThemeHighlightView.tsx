"use client";

import { cn } from "@/lib/helpers";
import type { Theme } from "@/types/theme";
import { useThemeHighlightData } from "@/hooks/useThemeHighlightData";
import { ThemeToggleButtons } from "@/components/highlight/ThemeToggleButtons";
import { TextWithHighlights } from "@/components/highlight/TextWithHighlights";
import { HighlightLoadingState } from "@/components/highlight/HighlightLoadingState";

type ThemeHighlightViewProps = {
  className?: string;
  themes?: Theme[];
  fullText?: string;
};

export function ThemeHighlightView({
  className,
  themes: propThemes,
  fullText: propFullText,
}: ThemeHighlightViewProps) {
  const {
    themes,
    fullText,
    selectedThemeIds,
    highlightRanges,
    allHighlightableRanges,
    toggleTheme,
    isLoading,
  } = useThemeHighlightData({ propThemes, propFullText });

  if (isLoading) {
    return <HighlightLoadingState className={className} />;
  }

  return (
    <div className={cn("h-full w-full flex flex-col", className)}>
      {/* Static centered container matching write page */}
      <div className="mx-auto max-w-2xl w-full h-full px-4 flex flex-col min-h-0">
        {/* Theme selection buttons */}
        <ThemeToggleButtons
          themes={themes!}
          selectedThemeIds={selectedThemeIds}
          onThemeToggle={toggleTheme}
        />

        {/* Scrollable text area fills remaining height */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4">
          <TextWithHighlights
            text={fullText}
            currentRanges={highlightRanges}
            allRanges={allHighlightableRanges}
          />
        </div>
      </div>
    </div>
  );
}
