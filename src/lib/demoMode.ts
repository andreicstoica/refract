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
