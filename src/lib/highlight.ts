import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import type { HighlightRange, SegmentPaintState } from "@/types/highlight";

export const STAGGER_PER_CHUNK = 0.03; // 30ms per contiguous highlighted chunk
// Minimum cosine similarity a chunk must have to its cluster centroid
// to be included in the returned theme chunks
export const MIN_CHUNK_CORRELATION = 0.55;

export function rangesFromThemes(
	themeList: Theme[] | null,
	sentenceMap: Map<string, Sentence>,
	filterIds?: Set<string>
): HighlightRange[] {
	if (!themeList) return [];

	const ranges: HighlightRange[] = [];

	for (const theme of themeList) {
		if (filterIds && !filterIds.has(theme.id)) continue;
		if (!theme.chunks) continue;

		const color = theme.color ?? "#93c5fd";

		// Precompute per-theme normalized correlations to enhance contrast if needed
		const norms: number[] = theme.chunks
			.map((c) => {
				const corr = (c as any).correlation as number | undefined;
				if (typeof corr === "number" && !Number.isNaN(corr)) {
					return Math.max(0, Math.min(1, (corr + 1) / 2));
				}
				return undefined;
			})
			.filter((v): v is number => typeof v === "number");

		const hasCorr = norms.length > 0;
		const minNorm = hasCorr ? Math.min(...norms) : 0.5;
		const maxNorm = hasCorr ? Math.max(...norms) : 0.5;
		const spread = maxNorm - minNorm;
		const useStretch = hasCorr && spread < 0.15; // stretch only when very bunched

		for (const chunk of theme.chunks) {
			const sentence = sentenceMap.get(chunk.sentenceId);
			if (sentence) {
				// If we have per-chunk correlation (cosine similarity), normalize it to [0,1]
				// and optionally stretch contrast within the theme for clearer variation.
				const corr = (chunk as any).correlation as number | undefined;
				let intensity = 0.5;
				if (typeof corr === "number" && !Number.isNaN(corr)) {
					const normalized = Math.max(0, Math.min(1, (corr + 1) / 2));
					if (useStretch) {
						const stretched = spread > 0 ? (normalized - minNorm) / spread : 0.5;
						// map to a softer range [0.3, 0.9] for gentler contrast
						intensity = 0.3 + 0.6 * Math.max(0, Math.min(1, stretched));
					} else {
						intensity = normalized;
					}
				}
				ranges.push({
					start: sentence.startIndex,
					end: sentence.endIndex,
					color,
					themeId: theme.id,
					intensity,
				});
			}
		}
	}

	return ranges.sort((a, b) => a.start - b.start);
}

export function buildCutPoints(text: string, allRanges: HighlightRange[]): number[] {
	const cutSet = new Set<number>([0, text.length]);

	for (const r of allRanges) {
		cutSet.add(r.start);
		cutSet.add(r.end);
	}

	return Array.from(cutSet).sort((a, b) => a - b);
}

export function createSegments(cuts: number[]): Array<{ start: number; end: number }> {
	const segments: Array<{ start: number; end: number }> = [];

	for (let i = 0; i < cuts.length - 1; i++) {
		const start = cuts[i];
		const end = cuts[i + 1];
		if (end > start) segments.push({ start, end });
	}

	return segments;
}


export function computeSegmentPaintState(
	segments: Array<{ start: number; end: number }>,
	activeRanges: HighlightRange[]
): SegmentPaintState[] {
	return segments.map(({ start, end }) => {
		let color: string | null = null;
		let intensity: number | null = null;
		let themeId: string | null = null;

		for (const r of activeRanges) {
			if (r.start <= start && r.end >= end) {
				color = r.color;
				intensity = r.intensity;
				themeId = r.themeId;
				break; // Take first match since we don't need priority
			}
		}

		return { start, end, color, intensity, themeId };
	});
}

export function assignChunkIndices(segmentPaintState: SegmentPaintState[]): number[] {
	const chunkIndex: number[] = new Array(segmentPaintState.length).fill(-1);
	let currentChunk = -1;

	for (let i = 0; i < segmentPaintState.length; i++) {
		const isActive = Boolean(segmentPaintState[i].color);
		if (isActive) {
			if (i === 0 || !segmentPaintState[i - 1].color) currentChunk += 1;
			chunkIndex[i] = currentChunk;
		}
	}

	return chunkIndex;
}
