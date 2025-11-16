"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Header animation hook that reveals theme controls:
 * - Switches layout from centered to space-between
 * - Slides timer to the left, fades in reload + chip controls
 */
export function useHeaderRevealAnimation(
	hasThemes: boolean,
	chipsRef: React.RefObject<HTMLDivElement | null>,
	reloadButtonRef: React.RefObject<HTMLButtonElement | null>
) {
	const hasAnimatedRef = useRef(false);

	useEffect(() => {
		if (!hasThemes || hasAnimatedRef.current) return;
		hasAnimatedRef.current = true;
		const prefersReduced =
			window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReduced) return;

		const headerContainer = document.querySelector(
			"[data-header-container]"
		) as HTMLElement | null;
		const timerContainer = headerContainer?.querySelector(
			"[data-timer-container]"
		) as HTMLElement | null;

		if (headerContainer && timerContainer) {
			const tl = gsap.timeline();
			tl.call(() => {
				headerContainer.classList.remove("justify-center");
				headerContainer.classList.add("justify-between");
				const containerWidth = headerContainer.offsetWidth;
				const timerEl = timerContainer.firstElementChild as HTMLElement | null;
				const timerWidth = timerEl?.offsetWidth || 0;
				const centerOffset = containerWidth / 2 - timerWidth / 2;
				gsap.set(timerContainer, { x: centerOffset });
				if (reloadButtonRef.current) {
					gsap.set(reloadButtonRef.current, { opacity: 0, scale: 0.98 });
				}
			})
				.to(timerContainer, { x: 0, duration: 1, ease: "sine.inOut" })
				.fromTo(
					reloadButtonRef.current,
					{ opacity: 0, scale: 0.98 },
					{ opacity: 1, scale: 1, duration: 0.9, ease: "sine.inOut" },
					">-0.25"
				)
				.fromTo(
					chipsRef.current,
					{ opacity: 0, scale: 0.98 },
					{ opacity: 1, scale: 1, duration: 0.9, ease: "sine.inOut" },
					"<"
				);
		}
	}, [hasThemes, chipsRef, reloadButtonRef]);
}

