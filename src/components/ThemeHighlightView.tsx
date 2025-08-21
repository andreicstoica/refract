"use client";

import { cn } from "@/utils/utils";
import type { Theme } from "@/types/theme";
import { useThemeHighlightData } from "@/hooks/useThemeHighlightData";
import {
  ThemeSelector,
  HighlightedText,
  LoadingState,
} from "@/components/highlight";

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
    return <LoadingState className={className} />;
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Static centered container matching write page */}
      <div className="mx-auto max-w-2xl w-full h-full px-4">
        <div className="h-full overflow-hidden flex flex-col min-h-0">
          {/* Theme selection buttons */}
          <ThemeSelector
            themes={themes!}
            selectedThemeIds={selectedThemeIds}
            onThemeToggle={toggleTheme}
          />

          {/* Scrollable text area fills remaining height */}
          <div className="relative flex-1 min-h-0">
            <div className="h-full overflow-y-auto overflow-x-hidden py-6">
              <HighlightedText
                text={fullText}
                currentRanges={highlightRanges}
                allRanges={allHighlightableRanges}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
