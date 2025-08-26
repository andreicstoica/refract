'use client';

import { usePathname } from 'next/navigation';

/**
 * Hook to detect if we're on the demo route
 * Demo mode uses more eager settings for showcasing
 */
export function useDemoMode(): boolean {
	const pathname = usePathname();
	return pathname === '/demo';
}

/**
 * Demo chip configuration - single source of truth
 */
export const DEMO_CHIP_CONFIG = {
	// The exact sentence to trigger the demo chip
	targetSentence: "how i spend my time will rly change once i finish the bootcamp.",
	// The chip text to show
	chipText: "What exactly changes for you?",
	// Delay in milliseconds after finishing the sentence
	delayMs: 1000, // Reduced from 3000
} as const;

/**
 * Get timing configuration based on demo mode
 */
export function getTimingConfig(isDemoMode: boolean) {
	if (isDemoMode) {
		return {
			// Demo mode: Much more eager for showcasing
			cooldownMs: 100, // Reduced from 200
			charTrigger: 15, // Reduced from 20
			settlingMs: 200, // Reduced from 500
			rateLimitMs: 25, // Reduced from 50
			trailingDebounceMs: 200, // Reduced from 400
			emoji: '🎬'
		};
	}

	return {
		// Production mode: Conservative for actual journaling
		cooldownMs: 500,
		charTrigger: 30,
		settlingMs: 700,
		rateLimitMs: 75,
		trailingDebounceMs: 700,
		emoji: '📝'
	};
}