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
	targetSentence: "how i spend my time will rly change when i finish this bootcamp.",
	// The chip text to show
	chipText: "What exactly changes for you?",
	// Base delay after finishing the sentence (ms)
	delayMs: 2000,
	// Require a minimum idle period before scheduling the chip (ms)
	minIdleBeforeScheduleMs: 1200,
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
