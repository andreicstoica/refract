"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { ThemeBubble } from "./ThemeBubble";
import { cn } from "@/utils/utils";

import type { Theme } from "@/types/theme";

interface ThemeBubbleContainerProps {
  themes: Theme[];
  onThemeSelect?: (themeId: string) => void;
  className?: string;
}

export function ThemeBubbleContainer({
  themes,
  onThemeSelect,
  className,
}: ThemeBubbleContainerProps) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const isSmall =
    containerSize.width > 0 && containerSize.height > 0
      ? containerSize.width <= 480 || containerSize.height <= 700
      : false;
  const isUltraShort =
    containerSize.height > 0 ? containerSize.height <= 600 : false;
  const isUltraNarrow =
    containerSize.width > 0 ? containerSize.width <= 360 : false;
  const expandedScale = isUltraShort ? 1.5 : isSmall ? 1.8 : 2.5;
  const clipRadiusFactor =
    isUltraShort || isUltraNarrow ? 0.4 : isSmall ? 0.48 : 0.65;
  // Always cap visible clips to 5 (design choice)
  const maxClips = 5;
  const clipCardSize =
    isUltraShort || isUltraNarrow
      ? { width: 60, height: 30 }
      : isSmall
      ? { width: 70, height: 35 }
      : { width: 80, height: 40 };
  // Slightly increase mobile font sizes for readability; make desktop small too
  const clipTextClassName =
    isUltraShort || isUltraNarrow
      ? "text-[7px]"
      : isSmall
      ? "text-[8px]"
      : "text-[9px]";
  const listMode = isUltraNarrow || isSmall || isUltraShort;
  const clipLineClamp = listMode ? 3 : 999; // no clamp on desktop orbit
  const listPanelMaxWidthPx = isSmall || isUltraNarrow ? 520 : 900;
  const listPanelMaxHeightVH = 70;
  // On larger screens, let orbit cards size to their content
  const autoClipWidth = !listMode;
  // Spacing estimate for orbit placement when auto sizing
  const estimatedClipWidthPx = 140;
  const maxClipWidthPx = 260;

  // Track container size to keep bubbles fully within bounds
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Helper to clamp a percentage position so the circle stays fully visible
  function clampPosition(
    posPct: { x: number; y: number },
    diameterPx: number,
    size: { width: number; height: number },
    margin = 8
  ) {
    if (!size.width || !size.height) {
      // Fallback when size unknown: keep within 12%-88%
      return {
        x: Math.max(12, Math.min(88, posPct.x)),
        y: Math.max(12, Math.min(88, posPct.y)),
      };
    }
    const radius = diameterPx / 2;
    const minX = ((radius + margin) / size.width) * 100;
    const maxX = (1 - (radius + margin) / size.width) * 100;
    const minY = ((radius + margin) / size.height) * 100;
    const maxY = (1 - (radius + margin) / size.height) * 100;
    return {
      x: Math.max(minX, Math.min(maxX, posPct.x)),
      y: Math.max(minY, Math.min(maxY, posPct.y)),
    };
  }

  // Improved bubble layout using full screen height and better spacing
  const bubblePositions = useMemo(() => {
    if (themes.length === 0) return [];

    // Create bubbles with base sizes
    const bubbles = themes.map((theme) => ({
      theme,
      size: 80 + theme.confidence * 40,
    }));

    // Seed positions clustered around center
    const positions = bubbles.map((b, i) => {
      const diameter = b.size * (0.8 + b.theme.confidence * 0.4);
      const jitterX = (Math.random() - 0.5) * 12; // +/- 6%
      const jitterY = (Math.random() - 0.5) * 12;
      const pos = clampPosition(
        { x: 50 + jitterX, y: 50 + jitterY },
        diameter,
        containerSize
      );
      return { theme: b.theme, position: pos, size: b.size };
    });

    // Simple separation loop to avoid overlap, keep near center
    const minWH = Math.max(
      1,
      Math.min(containerSize.width, containerSize.height)
    );
    const marginPct = 2; // extra separation margin in percent space

    for (let iter = 0; iter < 24; iter++) {
      // pairwise separation
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          const da = a.size * (0.8 + a.theme.confidence * 0.4);
          const db = b.size * (0.8 + b.theme.confidence * 0.4);
          const raPct = (da / minWH) * 50; // radius in percent approx
          const rbPct = (db / minWH) * 50;

          let dx = b.position.x - a.position.x;
          let dy = b.position.y - a.position.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = raPct + rbPct + marginPct;
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            dx /= dist;
            dy /= dist;
            a.position.x -= dx * overlap;
            a.position.y -= dy * overlap;
            b.position.x += dx * overlap;
            b.position.y += dy * overlap;
          }
        }
      }

      // gentle pull to center and clamp
      for (const p of positions) {
        p.position.x += (50 - p.position.x) * 0.05;
        p.position.y += (50 - p.position.y) * 0.05;
        const diameter = p.size * (0.8 + p.theme.confidence * 0.4);
        const clamped = clampPosition(p.position, diameter, containerSize);
        p.position = clamped;
      }
    }

    return positions;
  }, [themes, containerSize]);

  // Calculate displaced positions when a bubble is expanded
  const adjustedPositions = useMemo(() => {
    if (!expandedTheme) return bubblePositions;

    const expandedIndex = bubblePositions.findIndex(
      (bp) => bp.theme.id === expandedTheme
    );
    if (expandedIndex === -1) return bubblePositions;

    const expanded = bubblePositions[expandedIndex];
    const baseDiameter =
      expanded.size * (0.8 + expanded.theme.confidence * 0.4);
    const expandedDiameter = baseDiameter * expandedScale;

    // Place expanded bubble at center (clamped just in case)
    const centerPos = clampPosition(
      { x: 50, y: 50 },
      expandedDiameter,
      containerSize
    );

    // Arrange others on a ring around center
    const others = bubblePositions.filter((_, i) => i !== expandedIndex);
    const ringRadius = isUltraShort || isUltraNarrow ? 14 : isSmall ? 18 : 24; // percent units
    const arranged = others.map((bp, i) => {
      const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
      const target = {
        x: centerPos.x + Math.cos(angle) * ringRadius,
        y: centerPos.y + Math.sin(angle) * ringRadius,
      };
      const diameter = bp.size * (0.8 + bp.theme.confidence * 0.4);
      const bounded = clampPosition(target, diameter, containerSize);
      return { ...bp, position: bounded };
    });

    // Quick separation pass for others
    const minWH = Math.max(
      1,
      Math.min(containerSize.width, containerSize.height)
    );
    const marginPct = 2;
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < arranged.length; i++) {
        for (let j = i + 1; j < arranged.length; j++) {
          const a = arranged[i];
          const b = arranged[j];
          const da = a.size * (0.8 + a.theme.confidence * 0.4);
          const db = b.size * (0.8 + b.theme.confidence * 0.4);
          const raPct = (da / minWH) * 50;
          const rbPct = (db / minWH) * 50;
          let dx = b.position.x - a.position.x;
          let dy = b.position.y - a.position.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = raPct + rbPct + marginPct;
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            dx /= dist;
            dy /= dist;
            a.position.x -= dx * overlap;
            a.position.y -= dy * overlap;
            b.position.x += dx * overlap;
            b.position.y += dy * overlap;
            // clamp after move
            a.position = clampPosition(a.position, da, containerSize);
            b.position = clampPosition(b.position, db, containerSize);
          }
        }
      }
    }

    // Build final array with expanded at center
    const finalPositions = [...arranged];
    finalPositions.splice(expandedIndex, 0, {
      ...expanded,
      position: centerPos,
    });
    return finalPositions;
  }, [bubblePositions, expandedTheme, containerSize]);

  const handleExpand = (themeId: string) => {
    setExpandedTheme(themeId);
    onThemeSelect?.(themeId);
  };

  const handleCollapse = () => {
    setExpandedTheme(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("relative w-full h-full", "overflow-visible", className)}
      ref={containerRef}
    >
      {/* Subtle bubble color tints in bottom corners */}
      {themes.length > 0 && (
        <>
          <div
            className="absolute bottom-0 left-0 w-96 h-96 opacity-40 pointer-events-none"
            style={{
              background: `radial-gradient(circle at bottom left, ${
                themes[0]?.color || "#3b82f6"
              }40, transparent 50%)`,
            }}
          />
          {themes[1] && (
            <div
              className="absolute bottom-0 right-0 w-96 h-96 opacity-40 pointer-events-none"
              style={{
                background: `radial-gradient(circle at bottom right, ${
                  themes[1]?.color || "#8b5cf6"
                }40, transparent 50%)`,
              }}
            />
          )}
        </>
      )}

      {/* Theme bubbles */}
      <AnimatePresence>
        {adjustedPositions.map(({ theme, position, size }) => (
          <ThemeBubble
            key={theme.id}
            theme={theme}
            position={position}
            size={size}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            isExpanded={expandedTheme === theme.id}
            expandedScale={expandedTheme === theme.id ? expandedScale : 1}
            clipRadiusFactor={clipRadiusFactor}
            maxClips={maxClips}
            clipCardSize={clipCardSize}
            autoClipWidth={autoClipWidth}
            estimatedClipWidthPx={estimatedClipWidthPx}
            maxClipWidthPx={maxClipWidthPx}
            draggable={isSmall}
            dragConstraintsRef={containerRef}
            clipTextClassName={clipTextClassName}
            clipLineClamp={clipLineClamp}
            listMode={listMode}
            listPanelMaxWidthPx={listPanelMaxWidthPx}
            listPanelMaxHeightVH={listPanelMaxHeightVH}
            containerSize={containerSize}
          />
        ))}
      </AnimatePresence>

      {/* Instructions overlay */}
      {themes.length > 0 && !expandedTheme && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        ></motion.div>
      )}
    </motion.div>
  );
}
