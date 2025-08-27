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

// Sample journaling content for demo
export const DEMO_TEXT = `New routines. That’s the thing I keep circling. Bootcamp rhythm is ending soon—daily check-ins, late night commits, constant chatter on Slack. After graduation, I’ll have to build my own cadence again. No one setting the schedule. Just me. Exciting and a little scary.
Demo in less than two weeks. Time moves fast, but also slow. The app works in chunks. Each piece fine on its own, but together it’s still messy. Not a story yet. Needs arc. Needs one clear takeaway. Judges won’t remember the stack, they’ll remember how it felt. That’s what keeps looping in my head: it has to feel good to use.
This morning I polished layout—fonts, spacing, little animations. For a second it felt slick, almost real. Then I broke the data sync. Classic. Two hours gone sideways. Fixed it, but left drained. Everyone else is riding the same wave—screenshots, bugs, tired jokes. Whole cohort buzzing on stress and pride.
I keep circling the pitch. Ninety seconds. Show, not tell. Hook early, wow moment, clean close. Wrote it again. Fewer words. More clicks. Then realized—too many clicks. Judges won’t wait. Every extra step is a chance to lose them. Simplify.
Practiced once on Loom. Awkward. Too fast. Forgot to pause. Harder than coding. But watching back shows what lands, what drags. Tomorrow: cut one more feature, tighten flow, trust the basics. Not about showing everything. Just the one thing that matters.`;

