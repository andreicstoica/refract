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

// Simple chip positioning - just place chips below their sentences
export function computeChipLayout(
    prods: Prod[],
    sentencePositions: Map<string, SentencePosition>,
    bounds: LayoutBounds
): Map<string, ChipPlacement> {
    const result = new Map<string, ChipPlacement>();
    if (!bounds.containerWidth || bounds.containerWidth <= 0) return result;

    // Group prods by sentence to handle multiple chips per sentence
    const prodsBySentence = new Map<string, Prod[]>();
    for (const prod of prods) {
        if (!prodsBySentence.has(prod.sentenceId)) {
            prodsBySentence.set(prod.sentenceId, []);
        }
        prodsBySentence.get(prod.sentenceId)!.push(prod);
    }

    // Process each sentence's prods
    for (const [sentenceId, sentenceProds] of prodsBySentence) {
        const pos = sentencePositions.get(sentenceId);
        if (!pos) continue;

        // Sort prods by timestamp for consistent ordering
        const sortedProds = sentenceProds.sort((a, b) => a.timestamp - b.timestamp);

        // Position each prod for this sentence
        for (let i = 0; i < sortedProds.length; i++) {
            const prod = sortedProds[i];
            const chipWidth = Math.max(120, prod.text.length * 7.5 + 40); // Estimate width

            // Simple horizontal positioning: first chip near sentence end, others to the right
            let horizontalOffset = 0;
            if (i === 0) {
                // First chip: try to position near sentence end
                const sentenceEnd = pos.left + pos.width;
                const preferredLeft = sentenceEnd - chipWidth;
                horizontalOffset = Math.max(0, preferredLeft - pos.left);
            } else {
                // Additional chips: stack to the right with gap
                horizontalOffset = i * (chipWidth + 16);
            }

            // Ensure chip doesn't overflow right boundary
            const maxOffset = bounds.containerWidth - bounds.rightPad - chipWidth - pos.left;
            horizontalOffset = Math.min(horizontalOffset, Math.max(0, maxOffset));

            // Ensure chip doesn't go too far left
            horizontalOffset = Math.max(horizontalOffset, bounds.leftPad - pos.left);

            // Vertical offset: all chips below the sentence
            const verticalOffset = 24; // Fixed gap below sentence

            result.set(prod.id, {
                h: horizontalOffset,
                v: verticalOffset,
                maxWidth: chipWidth,
            });
        }
    }

    return result;
}

