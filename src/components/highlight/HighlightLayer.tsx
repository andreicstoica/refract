"use client";

import { cn } from "@/lib/helpers";
import type { HighlightRange } from "@/types/highlight";
import { TEXT_DISPLAY_STYLES } from "@/lib/constants";
import {
	buildCutPoints,
	createSegments,
	computeSegmentMeta,
} from "@/lib/highlight";

type HighlightLayerProps = {
	text: string;
	currentRanges: HighlightRange[];
	allRanges: HighlightRange[];
	className?: string;
	scrollTop?: number;
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
}: HighlightLayerProps) {
	const cuts = buildCutPoints(text, allRanges);
	const segments = createSegments(cuts);
	const meta = computeSegmentMeta(segments, currentRanges);

	return (
		<div
			className={cn(
				"absolute inset-0 pointer-events-none z-0 overflow-hidden",
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
				}}
			>
				{meta.map(({ start, end, color, intensity }) => {
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
						>
							{str}
						</span>
					);
				})}
			</div>
		</div>
	);
}
