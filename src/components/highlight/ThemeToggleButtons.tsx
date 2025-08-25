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
          className={cn(
            "flex gap-2 overflow-x-auto scrollbar-hide scroll-px-3 scrollable",
            noXPad ? undefined : "px-4"
          )}
          style={{
            scrollPaddingInline: "var(--chip-gutter, 8px)",
          }}
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
                  // Base button styling
                  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
                  // Match timer neutral container styling and explicit height
                  "h-10 px-3 bg-muted/50 backdrop-blur-sm border border-border/50",
                  // Subtle active state
                  "active:scale-95",
                  // Text color based on selection
                  isSelected ? "text-foreground" : "text-foreground/70"
                )}
                style={{
                  ["--chip-color" as any]: baseColor,
                  // Slight tint when selected; otherwise rely on neutral bg
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${baseColor} 10%, hsl(var(--muted) / 0.5))`
                    : undefined,
                  borderColor: isSelected
                    ? `color-mix(in srgb, ${baseColor} 30%, hsl(var(--border) / 0.5))`
                    : undefined,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${baseColor} ${
                    isSelected ? 12 : 6
                  }%, hsl(var(--muted) / 0.5))`;
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${baseColor} 30%, hsl(var(--border) / 0.5))`;
                }}
                onMouseLeave={(e) => {
                  if (isSelected) {
                    e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${baseColor} 10%, hsl(var(--muted) / 0.5))`;
                    e.currentTarget.style.borderColor = `color-mix(in srgb, ${baseColor} 30%, hsl(var(--border) / 0.5))`;
                  } else {
                    e.currentTarget.style.backgroundColor = "";
                    e.currentTarget.style.borderColor = "";
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
