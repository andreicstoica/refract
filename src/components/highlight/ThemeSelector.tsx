"use client";

import { useRef } from "react";
import type { Theme } from "@/types/theme";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";

type ThemeSelectorProps = {
  themes: Theme[];
  selectedThemeIds: string[];
  onThemeToggle: (themeId: string) => void;
};

export function ThemeSelector({
  themes,
  selectedThemeIds,
  onThemeToggle,
}: ThemeSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="shrink-0 pb-4 mb-4 pt-4">
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide"
        >
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
                onClick={() => onThemeToggle(theme.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center gap-2 border transition-colors whitespace-nowrap flex-shrink-0",
                  isSelected && "ring-1 ring-offset-0"
                )}
                style={{
                  ["--chip-color" as any]: baseColor,
                  background: `color-mix(in srgb, var(--chip-color) ${fillPct}%, transparent)`,
                  borderColor: `color-mix(in srgb, var(--chip-color) ${borderPct}%, transparent)`,
                }}
              >
                <span>{theme.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
