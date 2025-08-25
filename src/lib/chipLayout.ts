import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";

export interface ChipPlacement {
    h: number; // horizontal offset from sentence start
    v: number; // vertical offset in pixels
    maxWidth?: number; // optional max width
}

export interface LayoutBounds {
    containerWidth: number;
    leftPad: number;
    rightPad: number;
}

// Simple chip positioning - align chip end with sentence end
// Since we should never have multiple prods per sentence, this is straightforward
export function computeChipLayout(
    prods: Prod[],
    sentencePositions: Map<string, SentencePosition>,
    bounds: LayoutBounds
): Map<string, ChipPlacement> {
    const result = new Map<string, ChipPlacement>();
    if (!bounds.containerWidth || bounds.containerWidth <= 0) return result;

    for (const prod of prods) {
        const pos = sentencePositions.get(prod.sentenceId);
        if (!pos) continue;

        // Estimate chip width based on text length
        const chipWidth = Math.max(120, prod.text.length * 7.5 + 40);

        // Position chip so its end aligns with sentence end
        const sentenceEnd = pos.left + pos.width;
        const chipEnd = sentenceEnd;
        const chipStart = chipEnd - chipWidth;

        // Calculate horizontal offset (chip start relative to sentence start)
        let horizontalOffset = chipStart - pos.left;

        // Ensure chip doesn't overflow left boundary
        if (chipStart < bounds.leftPad) {
            horizontalOffset = bounds.leftPad - pos.left;
        }

        // Ensure chip doesn't overflow right boundary
        const maxChipStart = bounds.containerWidth - bounds.rightPad - chipWidth;
        if (chipStart > maxChipStart) {
            horizontalOffset = maxChipStart - pos.left;
        }

        // Vertical offset: chips appear below the sentence
        const verticalOffset = 24; // Fixed gap below sentence

        result.set(prod.id, {
            h: horizontalOffset,
            v: verticalOffset,
            maxWidth: chipWidth,
        });
    }

    return result;
}

