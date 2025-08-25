import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";

export interface ChipPlacement {
    h: number; // horizontal offset from sentence start (content area)
    v: number; // vertical offset in pixels (rows below the line)
    maxWidth?: number; // optional max width to ensure boundary clamping
}

export interface LayoutBounds {
    containerWidth: number;
    leftPad: number; // left content padding (px-4 => 16)
    rightPad: number; // right content padding
    gapX: number; // horizontal gap between chips
    rowGap: number; // vertical gap between rows of chips under a sentence
    maxRowsPerSentence: number; // to prevent excessive vertical growth
}

interface PlacedRect {
    left: number;
    right: number;
    top: number;
    bottom: number;
    prodId: string;
}

const DEFAULT_CHAR_PX = 7.5; // average px per character for cursive text
const MIN_CHIP_PX = 120; // minimum visual width for a chip
const CHROME_PX = 40; // padding + pin + spacing around text
const CHIP_HEIGHT = 20; // approximate chip height for collision

/**
 * Get natural chip position near the end of the sentence
 */
function getNaturalChipPosition(
    sentencePos: SentencePosition,
    containerWidth: number,
    chipWidth: number
): number {
    const sentenceEnd = sentencePos.left + sentencePos.width;
    const preferredPosition = sentenceEnd - chipWidth;

    // Ensure it stays within bounds
    return Math.max(
        16, // leftPad
        Math.min(preferredPosition, containerWidth - chipWidth - 16) // rightPad
    );
}

export function estimateChipWidthPx(text: string): number {
    return Math.max(MIN_CHIP_PX, Math.round(text.length * DEFAULT_CHAR_PX)) + CHROME_PX;
}

function chipBaseTopPx(pos: SentencePosition): number {
    const measured = pos.height ?? 44;
    const lineOffset = Math.min(44, measured);
    return pos.top + lineOffset + 4; // matches Chip.tsx computation (without verticalOffset)
}

function rectsOverlap(a: PlacedRect, b: PlacedRect): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function buildRect(left: number, top: number, width: number): PlacedRect {
    return {
        left,
        right: left + width,
        top,
        bottom: top + CHIP_HEIGHT,
        prodId: "",
    };
}

/**
 * Compute boundary-aware, collision-free placements for chips under sentences.
 * Ensures chips remain within left/right content bounds and do not overlap.
 */
export function computeChipLayout(
    prods: Prod[],
    sentencePositions: Map<string, SentencePosition>,
    bounds: LayoutBounds
): Map<string, ChipPlacement> {
    const result = new Map<string, ChipPlacement>();
    if (!bounds.containerWidth || bounds.containerWidth <= 0) return result;

    const rightLimit = bounds.containerWidth - bounds.rightPad;
    const placed: PlacedRect[] = [];

    // Sort by sentence vertical position, then by timestamp to stabilize ordering
    const sorted = [...prods].sort((a, b) => {
        const pa = sentencePositions.get(a.sentenceId);
        const pb = sentencePositions.get(b.sentenceId);
        const ya = pa ? chipBaseTopPx(pa) : 0;
        const yb = pb ? chipBaseTopPx(pb) : 0;
        if (ya !== yb) return ya - yb;
        return a.timestamp - b.timestamp;
    });

    for (const prod of sorted) {
        const pos = sentencePositions.get(prod.sentenceId);
        if (!pos) continue;

        const baseTop = chipBaseTopPx(pos);
        const estWidth = estimateChipWidthPx(prod.text);

        // Use natural positioning as preferred starting point, but ensure sequential placement for same sentence
        const naturalPosition = getNaturalChipPosition(pos, bounds.containerWidth, estWidth);
        const baseLeft = Math.max(bounds.leftPad, pos.left + bounds.leftPad);

        // For chips of the same sentence, start from the left to ensure sequential placement
        const existingChipsForSentence = placed.filter(r => {
            const probe = { ...r, prodId: r.prodId };
            const rowRect = buildRect(0, baseTop, 1);
            return rectsOverlap(probe, rowRect);
        });

        // Check if this is the first chip for this sentence
        const isFirstChipForSentence = existingChipsForSentence.length === 0;
        const startPosition = isFirstChipForSentence ? naturalPosition : baseLeft;
        const maxLeft = Math.max(bounds.leftPad, Math.min(startPosition, rightLimit - estWidth));

        let placedForThis = false;

        for (let row = 0; row < bounds.maxRowsPerSentence; row++) {
            const rowTop = baseTop + row * bounds.rowGap;
            // Build list of occupied intervals for this specific row
            const rowOccupants = placed.filter(r => {
                // Check if this placed rect is on the same row (within CHIP_HEIGHT tolerance)
                return Math.abs(r.top - rowTop) < CHIP_HEIGHT;
            });

            // Attempt placement starting from natural position, then fallback to left alignment
            let x = clamp(maxLeft, bounds.leftPad, rightLimit - estWidth);
            let iterations = 0;
            const maxIterations = 30; // Increased for better placement

            while (iterations < maxIterations) {
                iterations++;
                const current = buildRect(x, rowTop, estWidth);
                const collision = rowOccupants.find((r) => rectsOverlap(current, r));
                if (!collision) {
                    // Found a spot; clamp maxWidth to boundary to avoid overflow
                    const maxWidth = Math.max(0, rightLimit - x);
                    placed.push({ ...current, prodId: prod.id });
                    // Store offsets relative to sentence-left+padding (Chip will add sentence-left+padding)
                    result.set(prod.id, {
                        h: x - (pos.left + bounds.leftPad),
                        v: row * bounds.rowGap,
                        maxWidth,
                    });
                    placedForThis = true;
                    break;
                }

                // Try to place after the colliding rect with gap
                const nextX = collision.right + bounds.gapX;
                if (nextX + estWidth > rightLimit) {
                    // No room on this row; try next row
                    break;
                }
                x = nextX;
            }

            if (placedForThis) break;
        }

        if (!placedForThis) {
            // Last resort: put at left boundary on last row with maxWidth clamp
            const fallbackRow = bounds.maxRowsPerSentence - 1;
            const rowTop = baseTop + fallbackRow * bounds.rowGap;
            const x = bounds.leftPad;
            const maxWidth = Math.max(0, rightLimit - x);
            placed.push({ ...buildRect(x, rowTop, Math.min(estWidth, maxWidth)), prodId: prod.id });
            result.set(prod.id, {
                h: x - (pos.left + bounds.leftPad),
                v: fallbackRow * bounds.rowGap,
                maxWidth,
            });
        }
    }

    return result;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(Math.max(n, min), max);
}

