"use client";

import { useRef } from "react";
import type { Theme } from "@/types/theme";
import { cn } from "@/lib/helpers";

type ThemeToggleButtonsProps = {
  themes: Theme[];
  selectedThemeIds: string[];
  onThemeToggle: (themeId: string) => void;
};

export function ThemeToggleButtons({
  themes,
  selectedThemeIds,
  onThemeToggle,
}: ThemeToggleButtonsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="shrink-0 pb-4 mb-4 pt-4">
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4"
        >
          {themes.map((theme) => {
            const isSelected = selectedThemeIds.includes(theme.id);
            const baseColor = theme.color ?? "#93c5fd";
            const fillPct = isSelected ? 90 : 55; // more vibrant for both states

            return (
              <button
                key={theme.id}
                onClick={() => onThemeToggle(theme.id)}
                aria-pressed={isSelected}
                className={cn(
                  // Base button styling matching app style
                  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
                  // No border, solid background
                  "h-8 px-3 text-xs",
                  // Subtle active state
                  "active:scale-95",
                  // Text color based on selection
                  isSelected ? "text-white" : "text-foreground/80"
                )}
                style={{
                  ["--chip-color" as any]: baseColor,
                  background: `color-mix(in srgb, var(--chip-color) ${fillPct}%, ${isSelected ? 'white' : 'transparent'})`,
                }}
                onMouseEnter={(e) => {
                  const hoverFillPct = isSelected ? 95 : 70; // More vibrant hover for inactive too
                  e.currentTarget.style.background = `color-mix(in srgb, var(--chip-color) ${hoverFillPct}%, ${isSelected ? 'white' : 'transparent'})`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `color-mix(in srgb, var(--chip-color) ${fillPct}%, ${isSelected ? 'white' : 'transparent'})`;
                }}
              >
                {theme.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
