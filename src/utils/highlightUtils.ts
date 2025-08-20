import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import type { HighlightRange, SegmentMeta } from "@/types/highlight";

export const STAGGER_PER_CHUNK_S = 0.04; // 40ms per contiguous highlighted chunk

/**
 * Derives highlight ranges from a list of themes using pre-calculated sentence mappings
 * 
 * Performance optimized: Uses the sentenceId from embeddings chunks to directly map
 * to pre-computed startIndex/endIndex positions, avoiding expensive text search operations.
 */
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

        for (const chunk of theme.chunks) {
            const sentence = sentenceMap.get(chunk.sentenceId);
            if (sentence) {
                ranges.push({
                    start: sentence.startIndex,
                    end: sentence.endIndex,
                    color,
                    themeId: theme.id,
                });
            }
        }
    }

    return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Builds stable cut points for text segmentation
 */
export function buildCutPoints(text: string, allRanges: HighlightRange[]): number[] {
    const cutSet = new Set<number>([0, text.length]);

    for (const r of allRanges) {
        cutSet.add(r.start);
        cutSet.add(r.end);
    }

    return Array.from(cutSet).sort((a, b) => a - b);
}

/**
 * Creates text segments from cut points
 */
export function createSegments(cuts: number[]): Array<{ start: number; end: number }> {
    const segments: Array<{ start: number; end: number }> = [];

    for (let i = 0; i < cuts.length - 1; i++) {
        const start = cuts[i];
        const end = cuts[i + 1];
        if (end > start) segments.push({ start, end });
    }

    return segments;
}

/**
 * Builds theme priority order map
 */
export function buildThemeOrder(currentRanges: HighlightRange[]): Map<string, number> {
    const themeOrder = new Map<string, number>();
    let order = 0;

    for (const r of currentRanges) {
        if (!themeOrder.has(r.themeId)) themeOrder.set(r.themeId, order++);
    }

    return themeOrder;
}

/**
 * Computes segment metadata with colors and priorities
 */
export function computeSegmentMeta(
    segments: Array<{ start: number; end: number }>,
    currentRanges: HighlightRange[],
    themeOrder: Map<string, number>
): SegmentMeta[] {
    return segments.map(({ start, end }) => {
        let color: string | null = null;
        let bestPriority = -1;

        for (const r of currentRanges) {
            if (r.start <= start && r.end >= end) {
                const p = themeOrder.get(r.themeId) ?? -1;
                if (p > bestPriority) {
                    bestPriority = p;
                    color = r.color;
                }
            }
        }

        return { start, end, color };
    });
}

/**
 * Assigns chunk indices to contiguous active segments for staggered animation
 */
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
