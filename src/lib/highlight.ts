import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import type { HighlightRange, SegmentMeta } from "@/types/highlight";

export const STAGGER_PER_CHUNK_S = 0.04; // 40ms per contiguous highlighted chunk

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
		const intensity = theme.intensity ?? theme.confidence ?? 0.5;

		for (const chunk of theme.chunks) {
			const sentence = sentenceMap.get(chunk.sentenceId);
			if (sentence) {
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


export function computeSegmentMeta(
	segments: Array<{ start: number; end: number }>,
	currentRanges: HighlightRange[]
): SegmentMeta[] {
	return segments.map(({ start, end }) => {
		let color: string | null = null;
		let intensity: number | null = null;

		for (const r of currentRanges) {
			if (r.start <= start && r.end >= end) {
				color = r.color;
				intensity = r.intensity;
				break; // Take first match since we don't need priority
			}
		}

		return { start, end, color, intensity };
	});
}

export function assignChunkIndices(segmentMeta: SegmentMeta[]): number[] {
	const chunkIndex: number[] = new Array(segmentMeta.length).fill(-1);
	let currentChunk = -1;

	for (let i = 0; i < segmentMeta.length; i++) {
		const isActive = Boolean(segmentMeta[i].color);
		if (isActive) {
			if (i === 0 || !segmentMeta[i - 1].color) currentChunk += 1;
			chunkIndex[i] = currentChunk;
		}
	}

	return chunkIndex;
}

