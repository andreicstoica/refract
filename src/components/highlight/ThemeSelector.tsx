"use client";

import { useRef } from "react";
import type { Theme } from "@/types/theme";
import { cn } from "@/lib/helpers";

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
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4"
        >
          {themes.map((theme) => {
            const isSelected = selectedThemeIds.includes(theme.id);
            const baseColor = theme.color ?? "#93c5fd";
            const fillPct = isSelected ? 32 : 20; // background tint strength - stronger than before
            const borderPct = isSelected ? 50 : 35; // border tint strength

            return (
              <button
                key={theme.id}
                onClick={() => onThemeToggle(theme.id)}
                aria-pressed={isSelected}
                className={cn(
                  // Base shadcn button styling with smoother state transitions
                  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow,background-color,border-color,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  // Outline variant styling from shadcn
                  "border shadow-xs",
                  // Size sm from shadcn
                  "h-8 px-3 text-xs",
                  // Proper active/pressed state styling
                  "active:scale-95 active:shadow-none"
                )}
                style={{
                  ["--chip-color" as any]: baseColor,
                  ["--fill-pct" as any]: fillPct,
                  ["--border-pct" as any]: borderPct,
                  background: `color-mix(in srgb, var(--chip-color) ${fillPct}%, transparent)`,
                  borderColor: `color-mix(in srgb, var(--chip-color) ${borderPct}%, transparent)`,
                }}
                onMouseEnter={(e) => {
                  const hoverFillPct = isSelected ? 40 : 28; // Darker on hover
                  const hoverBorderPct = isSelected ? 58 : 43;
                  e.currentTarget.style.background = `color-mix(in srgb, var(--chip-color) ${hoverFillPct}%, transparent)`;
                  e.currentTarget.style.borderColor = `color-mix(in srgb, var(--chip-color) ${hoverBorderPct}%, transparent)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `color-mix(in srgb, var(--chip-color) ${fillPct}%, transparent)`;
                  e.currentTarget.style.borderColor = `color-mix(in srgb, var(--chip-color) ${borderPct}%, transparent)`;
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
