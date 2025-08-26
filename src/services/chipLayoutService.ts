import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { CHIP_LAYOUT } from "@/lib/constants";
import { makeFingerprint } from "@/lib/dedup";
import { logger, isMobileViewport, measureTextWidth } from "@/lib/helpers";

export interface ChipPlacement {
    h: number;
    v: number;
    maxWidth: number;
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
    pinnedIds: Set<string> = new Set()
): Map<string, ChipPlacement> {

    const isMobile = isMobileViewport(containerWidth, CHIP_LAYOUT.MOBILE_BREAKPOINT);
    const maxWidth = isMobile ? CHIP_LAYOUT.MOBILE_MAX_WIDTH : CHIP_LAYOUT.MAX_WIDTH;
    const minWidth = isMobile ? CHIP_LAYOUT.MOBILE_MIN_WIDTH : CHIP_LAYOUT.MIN_WIDTH;
    const spacing = isMobile ? CHIP_LAYOUT.MOBILE_SPACING : CHIP_LAYOUT.SPACING;
    const charMultiplier = isMobile ? CHIP_LAYOUT.MOBILE_CHAR_MULTIPLIER : CHIP_LAYOUT.DESKTOP_CHAR_MULTIPLIER;

    const result = new Map<string, ChipPlacement>();
    const prodGroups = groupProdsBySentence(prods);

    logger.debug(`Calculating chip layout for ${prods.length} prods in ${prodGroups.size} sentences | ${isMobile ? 'mobile' : 'desktop'} mode | container: ${containerWidth}px`);

    // Sort sentences by position (top to bottom, like existing clustering logic)
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

        // Calculate chip widths using actual text measurement
        const chipWidths = sorted.map(prod => {
            // Measure actual text width plus padding for the chip
            const textWidth = measureTextWidth(prod.text);
            const chipPadding = 24; // Left + right padding
            const pinIconWidth = 20; // Space for pin icon
            const actualWidth = textWidth + chipPadding + pinIconWidth;

            // Clamp to min/max width
            const clampedWidth = Math.min(maxWidth, Math.max(minWidth, actualWidth));

            logger.debug(`Text measurement for "${makeFingerprint(prod.text)}": textWidth=${textWidth}, actualWidth=${actualWidth}, clampedWidth=${clampedWidth}`);

            return clampedWidth;
        });

        const totalWidth = chipWidths.reduce((sum, w) => sum + w, 0) +
            (chipWidths.length - 1) * spacing;

        // Smart positioning: try end-align first, fallback to best fit
        const preferredStart = pos!.left + pos!.width - totalWidth; // End-align with sentence
        const availableSpace = containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD);

        let startX: number;
        if (totalWidth <= availableSpace) {
            // Chips fit - try end-align, but clamp to boundaries
            startX = Math.max(
                CHIP_LAYOUT.BOUNDARY_PAD,
                Math.min(preferredStart, containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - totalWidth)
            );
        } else {
            // Chips too wide - start from left boundary (will be trimmed later)
            startX = CHIP_LAYOUT.BOUNDARY_PAD;
        }

        logger.debug(`Positioning sentence chips: totalWidth=${totalWidth}px, availableSpace=${availableSpace}px, preferredStart=${preferredStart}, actualStart=${startX}`);

        // Check if entire sentence group fits
        const sentenceSkipped: string[] = [];

        if (totalWidth > containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)) {
            logger.warn(`Sentence group too wide: ${totalWidth}px > ${containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)}px available | sentence: "${pos!.left}"`, {
                sentenceId,
                chipCount: sorted.length,
                totalWidth,
                containerWidth,
                availableWidth: containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD),
                chipTexts: sorted.map(p => makeFingerprint(p.text))
            });
            // Skip entire sentence group if too wide
            totalSkipped += sorted.length;
            continue;
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

                logger.debug(`Mobile positioned chip "${makeFingerprint(prod.text)}": h=${placement.h}, v=${placement.v}, absoluteX=${clampedX}, chipWidth=${chipWidth}, containerWidth=${containerWidth}, availableSpace=${containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)}`);
            }
        } else {
            // Desktop: Complex multi-lane positioning with collision detection
            let currentX = startX;
            for (let index = 0; index < sorted.length; index++) {
                const prod = sorted[index];
                const chipWidth = chipWidths[index];

                // Find the best position (both horizontal and vertical) to avoid collisions
                let bestX = currentX;
                let bestOffsetY: number = CHIP_LAYOUT.OFFSET_Y;
                const maxVerticalLanes = 3; // Maximum number of vertical lanes to try
                const maxHorizontalShifts = 5; // More shifts on desktop for better positioning

                let foundPosition = false;

                // Try different vertical lanes
                for (let lane = 0; lane < maxVerticalLanes && !foundPosition; lane++) {
                    const testOffsetY = CHIP_LAYOUT.OFFSET_Y + (lane * (CHIP_LAYOUT.HEIGHT + 8));

                    // Try different horizontal positions within this lane
                    for (let shift = 0; shift < maxHorizontalShifts; shift++) {
                        const shiftIncrement = 16; // Standard increments on desktop
                        const testX = currentX + (shift * shiftIncrement);
                        let hasCollision = false;

                        // Check boundary collision (left and right edges) with safety margin
                        const absoluteLeft = testX;
                        const absoluteRight = testX + chipWidth;
                        const leftBoundary = CHIP_LAYOUT.BOUNDARY_PAD;
                        const safetyMargin = 4; // Standard safety margin on desktop
                        const rightBoundary = containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - safetyMargin;

                        if (absoluteLeft < leftBoundary || absoluteRight > rightBoundary) {
                            hasCollision = true;
                            logger.debug(`Boundary collision for "${makeFingerprint(prod.text)}": left=${absoluteLeft}, right=${absoluteRight}, boundaries=${leftBoundary}-${rightBoundary}, containerWidth=${containerWidth}, safetyMargin=${safetyMargin}`);
                            continue; // Try next horizontal position
                        }

                        // Check collision with all previously placed chips
                        for (const placedChip of placedChips) {
                            if (chipsOverlapVertically(pos!, placedChip.position, testOffsetY, placedChip.offsetY) &&
                                chipsOverlapHorizontally(pos!, placedChip.position, testX - pos!.left, placedChip.offsetX, chipWidth, placedChip.width)) {
                                hasCollision = true;
                                logger.debug(`Collision detected for "${makeFingerprint(prod.text)}" at lane ${lane}, shift ${shift}`);
                                break;
                            }
                        }

                        if (!hasCollision) {
                            bestX = testX;
                            bestOffsetY = testOffsetY;
                            foundPosition = true;
                            break;
                        }
                    }
                }

                // If no position found, skip this chip
                if (!foundPosition) {
                    logger.warn(`No position found for chip "${makeFingerprint(prod.text)}" - skipping`);
                    sentenceSkipped.push(makeFingerprint(prod.text));
                    totalSkipped++;
                    continue;
                }

                const placement = {
                    h: bestX - pos!.left,
                    v: bestOffsetY,
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

                logger.debug(`Desktop positioned chip "${makeFingerprint(prod.text)}": h=${placement.h}, v=${placement.v}, absoluteX=${bestX}, chipWidth=${chipWidth}, sentenceTop=${pos!.top}, sentenceLeft=${pos!.left}`);

                // Update currentX for next chip (but use original positioning logic for spacing)
                currentX += chipWidth + spacing;
            }
        }

        // Log skipped chips for this sentence
        if (sentenceSkipped.length > 0) {
            logger.warn(`Skipped ${sentenceSkipped.length} chips due to overflow in sentence:`, {
                sentenceId,
                skippedChips: sentenceSkipped,
                containerWidth,
                startX,
                availableWidth: containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - startX
            });
        }
    }

    logger.debug(`Chip layout complete: ${result.size} positioned, ${totalSkipped} skipped | container: ${containerWidth}px`);

    return result;
}
