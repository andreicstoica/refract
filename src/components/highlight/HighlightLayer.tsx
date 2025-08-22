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

	// Track previous segment metadata for exit animations with reverse stagger
	const prevRef = useRef<{
		meta: typeof meta | null;
		chunkIndex: number[] | null;
	}>({ meta: null, chunkIndex: null });

	// Determine reverse-stagger baseline for exiting segments (matching TextWithHighlights)
	const prevMeta = prevRef.current.meta;
	const prevIndex = prevRef.current.chunkIndex;
	let maxPrevExitingIdx = -1;
	if (prevMeta && prevIndex) {
		for (let i = 0; i < meta.length; i++) {
			const wasActive = Boolean(prevMeta[i]?.color);
			const isActive = Boolean(meta[i]?.color);
			if (wasActive && !isActive) {
				const p = prevIndex[i] ?? -1;
				if (p > maxPrevExitingIdx) maxPrevExitingIdx = p;
			}
		}
	}

	// Animate highlights with exact same logic as TextWithHighlights
	useEffect(() => {
		if (prefersReduced || !containerRef.current) return;

		const el = containerRef.current;
		const HIGHLIGHT_ANIM_TIME = 0.2;
		const STAGGER_PER_CHUNK = 0.03;

		// Animate each segment based on its state change
		for (let i = 0; i < meta.length; i++) {
			const segment = meta[i];
			const isActive = Boolean(segment.color);
			const wasActive = Boolean(prevMeta?.[i]?.color);
			const prevIdx = prevIndex?.[i] ?? -1;
			const exiting = !isActive && wasActive;
			
			// Skip if no state change
			if (isActive === wasActive) continue;

			const delay = isActive
				? chunkIndex[i] >= 0
					? chunkIndex[i] * STAGGER_PER_CHUNK
					: 0
				: exiting && prevIdx >= 0
				? maxPrevExitingIdx >= 0
					? (maxPrevExitingIdx - prevIdx) * STAGGER_PER_CHUNK
					: prevIdx * STAGGER_PER_CHUNK
				: 0;

			// Find the corresponding DOM node
			const node = el.querySelector<HTMLElement>(`span[data-segment="${i}"]`);
			if (node) {
				gsap.fromTo(
					node,
					{ 
						backgroundSize: isActive ? "0% 100%" : "100% 100%",
						backgroundPosition: "left top"
					},
					{ 
						backgroundSize: isActive ? "100% 100%" : "0% 100%",
						backgroundPosition: "left top",
						duration: HIGHLIGHT_ANIM_TIME,
						delay,
						ease: [0.22, 1, 0.36, 1]
					}
				);
			}
		}

		// Update ref for next comparison (matching TextWithHighlights)
		prevRef.current = { meta: [...meta], chunkIndex: [...chunkIndex] };
	}, [meta, chunkIndex, prefersReduced, maxPrevExitingIdx, prevMeta, prevIndex]);

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
				{meta.map(({ start, end, color, intensity, themeId }, i) => {
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
								backgroundPosition: "left top",
								display: "inline",
							}}
							data-active={isActive ? "1" : "0"}
							data-chunk={chunkIndex[i] >= 0 ? chunkIndex[i] : undefined}
							data-theme-id={themeId ?? undefined}
							data-segment={i}
						>
							{str}
						</span>
					);
				})}
			</div>
		</div>
	);
}
