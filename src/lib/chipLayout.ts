import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";
import { CHIP_LAYOUT } from "./constants";

const isDev = process.env.NODE_ENV !== "production";

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
 * Calculate layout for chips grouped by sentence with overflow logging
 */
export function calculateChipLayout(
	prods: Prod[],
	positionMap: Map<string, SentencePosition>,
	containerWidth: number,
	pinnedIds: Set<string> = new Set()
): Map<string, ChipPlacement> {
	
	const isMobile = containerWidth < CHIP_LAYOUT.MOBILE_BREAKPOINT;
	const maxWidth = isMobile ? CHIP_LAYOUT.MOBILE_MAX_WIDTH : CHIP_LAYOUT.MAX_WIDTH;
	const minWidth = isMobile ? CHIP_LAYOUT.MOBILE_MIN_WIDTH : CHIP_LAYOUT.MIN_WIDTH;
	const spacing = isMobile ? CHIP_LAYOUT.MOBILE_SPACING : CHIP_LAYOUT.SPACING;
	const charMultiplier = isMobile ? CHIP_LAYOUT.MOBILE_CHAR_MULTIPLIER : CHIP_LAYOUT.DESKTOP_CHAR_MULTIPLIER;
	
	const result = new Map<string, ChipPlacement>();
	const prodGroups = groupProdsBySentence(prods);
	
	if (isDev) {
		console.log(`🎯 Calculating chip layout for ${prods.length} prods in ${prodGroups.size} sentences | ${isMobile ? 'mobile' : 'desktop'} mode | container: ${containerWidth}px`);
	}
	
	// Sort sentences by position (top to bottom, like existing clustering logic)
	const sortedSentences = Array.from(prodGroups.keys())
		.map(id => ({ id, pos: positionMap.get(id) }))
		.filter(item => item.pos)
		.sort((a, b) => a.pos!.top - b.pos!.top);
	
	let totalSkipped = 0;
	
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
		
		// Calculate chip widths
		const chipWidths = sorted.map(prod => 
			Math.min(maxWidth, Math.max(minWidth, prod.text.length * charMultiplier + 30))
		);
		
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
		
		if (isDev) {
			console.log(`📐 Positioning sentence chips: totalWidth=${totalWidth}px, availableSpace=${availableSpace}px, preferredStart=${preferredStart}, actualStart=${startX}`);
		}
		
		// Check if entire sentence group fits
		const sentenceSkipped: string[] = [];
		
		if (totalWidth > containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)) {
			if (isDev) {
				console.warn(`🚨 Sentence group too wide: ${totalWidth}px > ${containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD)}px available | sentence: "${pos!.left}"`, {
					sentenceId,
					chipCount: sorted.length,
					totalWidth,
					containerWidth,
					availableWidth: containerWidth - (2 * CHIP_LAYOUT.BOUNDARY_PAD),
					chipTexts: sorted.map(p => p.text.substring(0, 30) + "...")
				});
			}
			// Skip entire sentence group if too wide
			totalSkipped += sorted.length;
			continue;
		}
		
		// Position chips horizontally
		let currentX = startX;
		sorted.forEach((prod, index) => {
			const chipWidth = chipWidths[index];
			
			// Skip if would overflow (graceful degradation with logging)
			if (currentX + chipWidth > containerWidth - CHIP_LAYOUT.BOUNDARY_PAD) {
				sentenceSkipped.push(prod.text.substring(0, 30) + "...");
				totalSkipped++;
				return;
			}
			
			const placement = {
				h: currentX - pos!.left,
				v: CHIP_LAYOUT.OFFSET_Y,
				maxWidth: chipWidth
			};
			
			result.set(prod.id, placement);
			
			if (isDev) {
				console.log(`📍 Positioned chip "${prod.text.substring(0, 20)}...": h=${placement.h}, absoluteX=${currentX}, chipWidth=${chipWidth}`);
			}
			
			currentX += chipWidth + spacing;
		});
		
		// Log skipped chips for this sentence
		if (sentenceSkipped.length > 0 && isDev) {
			console.warn(`⚠️ Skipped ${sentenceSkipped.length} chips due to overflow in sentence:`, {
				sentenceId,
				skippedChips: sentenceSkipped,
				containerWidth,
				startX,
				availableWidth: containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - startX
			});
		}
	}
	
	if (isDev) {
		console.log(`✅ Chip layout complete: ${result.size} positioned, ${totalSkipped} skipped | container: ${containerWidth}px`);
	}
	
	return result;
}