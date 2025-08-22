"use client";

import { useRef } from "react";
import type { Theme } from "@/types/theme";
import { cn } from "@/lib/helpers";

type ThemeToggleButtonsProps = {
  themes: Theme[];
  selectedThemeIds: string[];
  onThemeToggle: (themeId: string) => void;
  className?: string;
  noXPad?: boolean;
};

export function ThemeToggleButtons({
  themes,
  selectedThemeIds,
  onThemeToggle,
  className,
  noXPad,
}: ThemeToggleButtonsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("shrink-0", className)}>
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className={cn("flex gap-2 overflow-x-auto scrollbar-hide", noXPad ? undefined : "px-4")}
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
                  // Base button styling matching timer component
                  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
                  // Timer-style background and dimensions - theme aware
                  "h-10 px-4 bg-background/90 backdrop-blur-sm border border-border/20",
                  // Subtle active state
                  "active:scale-95",
                  // Text color based on selection
                  isSelected ? "text-foreground" : "text-foreground/70"
                )}
                style={{
                  ["--chip-color" as any]: baseColor,
                  backgroundColor: isSelected 
                    ? `color-mix(in srgb, ${baseColor} 15%, hsl(var(--background) / 0.9))`
                    : 'hsl(var(--background) / 0.9)',
                  borderColor: isSelected
                    ? `color-mix(in srgb, ${baseColor} 35%, hsl(var(--border) / 0.2))`
                    : 'hsl(var(--border) / 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${baseColor} ${isSelected ? 15 : 8}%, hsl(var(--background) / 0.9))`;
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${baseColor} 30%, hsl(var(--border) / 0.2))`;
                }}
                onMouseLeave={(e) => {
                  if (isSelected) {
                    e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${baseColor} 15%, hsl(var(--background) / 0.9))`;
                    e.currentTarget.style.borderColor = `color-mix(in srgb, ${baseColor} 35%, hsl(var(--border) / 0.2))`;
                  } else {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--background) / 0.9)';
                    e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.2)';
                  }
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
