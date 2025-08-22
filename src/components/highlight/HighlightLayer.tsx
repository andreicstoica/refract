"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/helpers";
import type { HighlightRange } from "@/types/highlight";
import { TEXT_DISPLAY_STYLES } from "@/lib/constants";
import {
	buildCutPoints,
	createSegments,
	computeSegmentMeta,
	assignChunkIndices,
} from "@/lib/highlight";
import { gsap } from "gsap";

type HighlightLayerProps = {
	text: string;
	currentRanges: HighlightRange[];
	allRanges: HighlightRange[];
	className?: string;
	scrollTop?: number;
	extraTopPaddingPx?: number;
};

// Minimal paint-only highlight overlay that mirrors the textarea content flow.
// No interactivity; caller controls visibility/opacity. Designed to be positioned
// as absolute inset-0 with pointer-events-none.
export function HighlightLayer({
	text,
	currentRanges,
	allRanges,
	className,
	scrollTop = 0,
	extraTopPaddingPx = 0,
}: HighlightLayerProps) {
	const cuts = useMemo(() => buildCutPoints(text, allRanges), [text, allRanges]);
	const segments = useMemo(() => createSegments(cuts), [cuts]);
	const meta = useMemo(() => computeSegmentMeta(segments, currentRanges), [segments, currentRanges]);
	const chunkIndex = useMemo(() => assignChunkIndices(meta), [meta]);

	const containerRef = useRef<HTMLDivElement>(null);
	const prefersReduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	// Animate highlight sweep on activation
	useEffect(() => {
		if (prefersReduced) return;
		if (!containerRef.current) return;
		if (!currentRanges || currentRanges.length === 0) return;

		const el = containerRef.current;
		const activeNodes = Array.from(el.querySelectorAll<HTMLElement>('span[data-active="1"][data-chunk]'));
		activeNodes.forEach((node) => {
			const idx = Number(node.dataset.chunk ?? -1);
			if (idx >= 0) {
				gsap.fromTo(
					node,
					{ backgroundSize: "0% 100%" },
					{ backgroundSize: "100% 100%", duration: 0.25, delay: idx * 0.03, ease: "power1.out" }
				);
			}
		});
	}, [currentRanges, prefersReduced]);

	return (
		<div
			ref={containerRef}
			className={cn(
				"absolute inset-0 pointer-events-none z-15 overflow-hidden",
				className
			)}
		>
			{/* Inner content translated to mirror textarea scroll */}
			<div
				className={cn(TEXT_DISPLAY_STYLES.CLASSES, "py-6 h-full")}
				style={{
					...TEXT_DISPLAY_STYLES.INLINE_STYLES,
					transform: `translateY(${-scrollTop}px)`,
					color: "transparent",
					paddingTop: `${24 + (extraTopPaddingPx || 0)}px`,
					transition: "padding-top 300ms ease",
				}}
			>
				{meta.map(({ start, end, color, intensity }, i) => {
					const str = text.slice(start, end);
					const isActive = Boolean(color);
					const opacity =
						intensity != null
							? Math.max(0.2, Math.min(0.7, 0.2 + intensity * 0.5))
							: undefined;

					return (
						<span
							key={`${start}-${end}`}
							className="inline"
							style={{
								WebkitBoxDecorationBreak: "clone",
								boxDecorationBreak: "clone",
								["--hl-color" as any]: color ?? undefined,
								backgroundImage:
									isActive && opacity != null
										? `linear-gradient(0deg, color-mix(in srgb, var(--hl-color) ${Math.round(
												opacity * 100
										  )}%, transparent), color-mix(in srgb, var(--hl-color) ${Math.round(
												opacity * 100
										  )}%, transparent))`
										: undefined,
								backgroundRepeat: "no-repeat",
								display: "inline",
							}}
							data-active={isActive ? "1" : "0"}
							data-chunk={chunkIndex[i] >= 0 ? chunkIndex[i] : undefined}
						>
							{str}
						</span>
					);
				})}
			</div>
		</div>
	);
}
