import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { CHIP_LAYOUT } from "@/lib/constants";
import { makeFingerprint } from "@/lib/dedup";
import { isMobileViewport, measureTextWidth } from "@/lib/helpers";
import { debug } from "@/lib/debug";

export interface ChipPlacement {
    h: number;
    v: number;
    maxWidth: number;
}

interface PlacementResult {
    placement: ChipPlacement;
    absoluteX: number;
}

const VERTICAL_LANE_GAP = CHIP_LAYOUT.HEIGHT + 8;
const SAFETY_MARGIN = 4;

function hasCollision(
    pos: SentencePosition,
    offsetX: number,
    offsetY: number,
    chipWidth: number,
    placedChips: Array<{ position: SentencePosition; offsetX: number; offsetY: number; width: number; }>
): boolean {
    return placedChips.some(placed =>
        chipsOverlapVertically(pos, placed.position, offsetY, placed.offsetY) &&
        chipsOverlapHorizontally(pos, placed.position, offsetX, placed.offsetX, chipWidth, placed.width)
    );
}

function isWithinHorizontalBounds(
    absoluteLeft: number,
    chipWidth: number,
    leftBoundary: number,
    rightBoundary: number
): boolean {
    if (absoluteLeft < leftBoundary) return false;
    return absoluteLeft + chipWidth <= rightBoundary;
}

function clampToBoundaries(
    targetLeft: number,
    chipWidth: number,
    leftBoundary: number,
    rightBoundary: number
): number | null {
    const maxLeft = rightBoundary - chipWidth;
    if (maxLeft < leftBoundary) {
        return null;
    }
    return Math.max(leftBoundary, Math.min(targetLeft, maxLeft));
}

function createPlacementResult(
    pos: SentencePosition,
    offsetX: number,
    offsetY: number,
    chipWidth: number
): PlacementResult {
    return {
        placement: {
            h: offsetX,
            v: offsetY,
            maxWidth: chipWidth,
        },
        absoluteX: pos.left + offsetX,
    };
}

function buildShiftSequence(attempts: number): number[] {
    const sequence: number[] = [];
    for (let i = 0; i < attempts; i++) {
        if (i === 0) {
            sequence.push(0);
            continue;
        }
        const magnitude = Math.ceil(i / 2);
        const direction = i % 2 === 0 ? -1 : 1;
        sequence.push(direction * magnitude);
    }
    return sequence;
}

function tryReusePinnedPlacement(options: {
    previousPlacement?: ChipPlacement;
    pos: SentencePosition;
    chipWidth: number;
    containerWidth: number;
    placedChips: Array<{ position: SentencePosition; offsetX: number; offsetY: number; width: number; }>;
}): PlacementResult | null {
    const { previousPlacement, pos, chipWidth, containerWidth, placedChips } = options;
    if (!previousPlacement) return null;

    const leftBoundary = CHIP_LAYOUT.BOUNDARY_PAD;
    const rightBoundary = containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - SAFETY_MARGIN;
    const clamped = clampToBoundaries(pos.left + previousPlacement.h, chipWidth, leftBoundary, rightBoundary);
    if (clamped === null) return null;

    const offsetX = clamped - pos.left;
    const offsetY = previousPlacement.v;

    if (hasCollision(pos, offsetX, offsetY, chipWidth, placedChips)) {
        return null;
    }

    return createPlacementResult(pos, offsetX, offsetY, chipWidth);
}

function findDesktopPlacement(options: {
    pos: SentencePosition;
    baseX: number;
    chipWidth: number;
    containerWidth: number;
    placedChips: Array<{ position: SentencePosition; offsetX: number; offsetY: number; width: number; }>;
    shiftSequence: number[];
    verticalLaneCount: number;
    shiftIncrement: number;
}): PlacementResult | null {
    const { pos, baseX, chipWidth, containerWidth, placedChips, shiftSequence, verticalLaneCount, shiftIncrement } = options;
    const leftBoundary = CHIP_LAYOUT.BOUNDARY_PAD;
    const rightBoundary = containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - SAFETY_MARGIN;

    for (let lane = 0; lane < verticalLaneCount; lane++) {
        const offsetY = CHIP_LAYOUT.OFFSET_Y + lane * VERTICAL_LANE_GAP;
        for (const step of shiftSequence) {
            const absoluteLeft = baseX + (step * shiftIncrement);
            if (!isWithinHorizontalBounds(absoluteLeft, chipWidth, leftBoundary, rightBoundary)) {
                continue;
            }

            const offsetX = absoluteLeft - pos.left;
            if (hasCollision(pos, offsetX, offsetY, chipWidth, placedChips)) {
                continue;
            }

            return createPlacementResult(pos, offsetX, offsetY, chipWidth);
        }
    }

    return null;
}

function fallbackPlacement(options: {
    pos: SentencePosition;
    chipWidth: number;
    containerWidth: number;
    placedChips: Array<{ position: SentencePosition; offsetX: number; offsetY: number; width: number; }>;
    verticalLaneCount: number;
}): PlacementResult | null {
    const { pos, chipWidth, containerWidth, placedChips, verticalLaneCount } = options;
    const leftBoundary = CHIP_LAYOUT.BOUNDARY_PAD;
    const rightBoundary = containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - SAFETY_MARGIN;
    const targetLeft = pos.left + pos.width - chipWidth;
    const clamped = clampToBoundaries(targetLeft, chipWidth, leftBoundary, rightBoundary);
    if (clamped === null) return null;

    const offsetX = clamped - pos.left;
    const offsetY = CHIP_LAYOUT.OFFSET_Y + verticalLaneCount * VERTICAL_LANE_GAP;

    if (hasCollision(pos, offsetX, offsetY, chipWidth, placedChips)) {
        return null;
    }

    return createPlacementResult(pos, offsetX, offsetY, chipWidth);
}

/**
 * Group prods by sentence (following existing chunk mapping patterns)
 */
export function groupProdsBySentence(prods: Prod[]): Map<string, Prod[]> {
    const groups = new Map<string, Prod[]>();

    for (const prod of prods) {
        if (!groups.has(prod.sentenceId)) {
            groups.set(prod.sentenceId, []);
        }
        groups.get(prod.sentenceId)!.push(prod);
    }

    return groups;
}

/**
 * Check if two chip placements would overlap vertically
 */
function chipsOverlapVertically(
    pos1: SentencePosition,
    pos2: SentencePosition,
    offsetY1: number,
    offsetY2: number
): boolean {
    const chipHeight = CHIP_LAYOUT.HEIGHT;
    const verticalGap = 8; // Minimum gap between chips

    const top1 = pos1.top + offsetY1;
    const bottom1 = top1 + chipHeight;
    const top2 = pos2.top + offsetY2;
    const bottom2 = top2 + chipHeight;

    // Check for vertical overlap with minimum gap
    return !(bottom1 + verticalGap <= top2 || bottom2 + verticalGap <= top1);
}

/**
 * Check if two chip placements would overlap horizontally
 */
function chipsOverlapHorizontally(
    pos1: SentencePosition,
    pos2: SentencePosition,
    offsetX1: number,
    offsetX2: number,
    width1: number,
    width2: number
): boolean {
    const horizontalGap = 4; // Minimum gap between chips

    const left1 = pos1.left + offsetX1;
    const right1 = left1 + width1;
    const left2 = pos2.left + offsetX2;
    const right2 = left2 + width2;

    // Check for horizontal overlap with minimum gap
    return !(right1 + horizontalGap <= left2 || right2 + horizontalGap <= left1);
}

/**
 * Calculate layout for chips grouped by sentence with overflow logging
 */
export function calculateChipLayout(
    prods: Prod[],
    positionMap: Map<string, SentencePosition>,
    containerWidth: number,
    pinnedIds: Set<string> = new Set(),
    previousLayout?: Map<string, ChipPlacement>
): Map<string, ChipPlacement> {

    const isMobile = isMobileViewport(containerWidth, CHIP_LAYOUT.MOBILE_BREAKPOINT);
    const maxWidth = isMobile ? CHIP_LAYOUT.MOBILE_MAX_WIDTH : CHIP_LAYOUT.MAX_WIDTH;
    const minWidth = isMobile ? CHIP_LAYOUT.MOBILE_MIN_WIDTH : CHIP_LAYOUT.MIN_WIDTH;
    const spacing = isMobile ? CHIP_LAYOUT.MOBILE_SPACING : CHIP_LAYOUT.SPACING;

    const result = new Map<string, ChipPlacement>();
    const prodGroups = groupProdsBySentence(prods);

    debug.dev(`Calculating chip layout for ${prods.length} prods in ${prodGroups.size} sentences | ${isMobile ? 'mobile' : 'desktop'} mode | container: ${containerWidth}px`);

    const sortedSentences = Array.from(prodGroups.keys())
        .map(id => ({ id, pos: positionMap.get(id) }))
        .filter(item => item.pos)
        .sort((a, b) => a.pos!.top - b.pos!.top);

    let totalSkipped = 0;

    // Track all placed chips for collision detection
    const placedChips: Array<{
        position: SentencePosition;
        offsetX: number;
        offsetY: number;
        width: number;
    }> = [];

    for (const { id: sentenceId, pos } of sortedSentences) {
        const sentenceProds = prodGroups.get(sentenceId)!;

        // Sort prods in sentence: pinned first, then by timestamp (maintaining existing priority logic)
        const sorted = sentenceProds.sort((a, b) => {
            const aPinned = pinnedIds.has(a.id);
            const bPinned = pinnedIds.has(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return a.timestamp - b.timestamp;
        });

        const chipWidths = sorted.map(prod => {
            const textWidth = measureTextWidth(prod.text);
            const chipPadding = 24; // Left + right padding
            const pinIconWidth = 20; // Space for pin icon
            const actualWidth = textWidth + chipPadding + pinIconWidth;

            const clampedWidth = Math.min(maxWidth, Math.max(minWidth, actualWidth));

            debug.dev(`Text measurement for "${makeFingerprint(prod.text)}": textWidth=${textWidth}, actualWidth=${actualWidth}, clampedWidth=${clampedWidth}`);

            return clampedWidth;
        });

        const totalWidth = chipWidths.reduce((sum, w) => sum + w, 0) +
            (chipWidths.length - 1) * spacing;

        const preferredStart = pos!.left + pos!.width - totalWidth; // End-align with sentence
        const availableSpace = containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD);

        let startX: number;
        if (totalWidth <= availableSpace) {
            startX = Math.max(
                CHIP_LAYOUT.BOUNDARY_PAD,
                Math.min(preferredStart, containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - totalWidth)
            );
        } else {
            // Chips too wide - start from left boundary (will be trimmed later)
            startX = CHIP_LAYOUT.BOUNDARY_PAD;
        }

        debug.dev(`Positioning sentence chips: totalWidth=${totalWidth}px, availableSpace=${availableSpace}px, preferredStart=${preferredStart}, actualStart=${startX}`);

        const sentenceSkipped: string[] = [];

        if (totalWidth > containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)) {
            debug.warn(`Sentence group too wide: ${totalWidth}px > ${containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)}px available | sentence: "${pos!.left}"`, {
                sentenceId,
                chipCount: sorted.length,
                totalWidth,
                containerWidth,
                availableWidth: containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD),
                chipTexts: sorted.map(p => makeFingerprint(p.text))
            });
        }

        // Position chips - simplified for mobile (one per row), complex for desktop
        if (isMobile) {
            // Mobile: Simple one-chip-per-row layout
            for (let index = 0; index < sorted.length; index++) {
                const prod = sorted[index];
                const chipWidth = chipWidths[index];

                // Center the chip horizontally within the container
                // Use actual measured width (no safety margin needed since we measured it)
                const centerX = (containerWidth - chipWidth) / 2;
                const clampedX = Math.max(
                    CHIP_LAYOUT.BOUNDARY_PAD,
                    Math.min(centerX, containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - chipWidth)
                );

                const placement = {
                    h: clampedX - pos!.left,
                    v: CHIP_LAYOUT.OFFSET_Y + (index * (CHIP_LAYOUT.HEIGHT + 8)), // Stack vertically
                    maxWidth: chipWidth
                };

                result.set(prod.id, placement);

                // Track this chip for future collision detection
                placedChips.push({
                    position: pos!,
                    offsetX: placement.h,
                    offsetY: placement.v,
                    width: chipWidth
                });

                debug.dev(`Mobile positioned chip "${makeFingerprint(prod.text)}": h=${placement.h}, v=${placement.v}, absoluteX=${clampedX}, chipWidth=${chipWidth}, containerWidth=${containerWidth}, availableSpace=${containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)}`);
            }
        } else {
            // Desktop: Complex multi-lane positioning with collision detection
            const shiftIncrement = 16;
            const verticalLaneCount = Math.min(5, Math.max(3, Math.ceil(sorted.length / 2)));
            const horizontalShiftAttempts = Math.min(11, Math.max(7, Math.ceil(containerWidth / 160)));
            const shiftSequence = buildShiftSequence(horizontalShiftAttempts);
            let currentX = startX;

            for (let index = 0; index < sorted.length; index++) {
                const prod = sorted[index];
                const chipWidth = chipWidths[index];
                let placement: PlacementResult | null = null;

                if (pinnedIds.has(prod.id)) {
                    placement = tryReusePinnedPlacement({
                        previousPlacement: previousLayout?.get(prod.id),
                        pos: pos!,
                        chipWidth,
                        containerWidth,
                        placedChips,
                    });

                    if (placement) {
                        debug.dev(`Reused pinned placement for "${makeFingerprint(prod.text)}"`);
                    }
                }

                if (!placement) {
                    placement = findDesktopPlacement({
                        pos: pos!,
                        baseX: currentX,
                        chipWidth,
                        containerWidth,
                        placedChips,
                        shiftSequence,
                        verticalLaneCount,
                        shiftIncrement,
                    });
                }

                if (!placement) {
                    placement = fallbackPlacement({
                        pos: pos!,
                        chipWidth,
                        containerWidth,
                        placedChips,
                        verticalLaneCount,
                    });
                }

                if (!placement) {
                    debug.warn(`No position found for chip "${makeFingerprint(prod.text)}" - skipping`);
                    sentenceSkipped.push(makeFingerprint(prod.text));
                    totalSkipped++;
                    continue;
                }

                result.set(prod.id, placement.placement);

                placedChips.push({
                    position: pos!,
                    offsetX: placement.placement.h,
                    offsetY: placement.placement.v,
                    width: chipWidth,
                });

                debug.dev(`Desktop positioned chip "${makeFingerprint(prod.text)}": h=${placement.placement.h}, v=${placement.placement.v}, absoluteX=${placement.absoluteX}, chipWidth=${chipWidth}, sentenceTop=${pos!.top}, sentenceLeft=${pos!.left}`);

                currentX = placement.absoluteX + chipWidth + spacing;
            }
        }

        if (sentenceSkipped.length > 0) {
            debug.warn(`Skipped ${sentenceSkipped.length} chips due to overflow in sentence:`, {
                sentenceId,
                skippedChips: sentenceSkipped,
                containerWidth,
                startX,
                availableWidth: containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - startX
            });
        }
    }

    debug.dev(`Chip layout complete: ${result.size} positioned, ${totalSkipped} skipped | container: ${containerWidth}px`);

    return result;
}
