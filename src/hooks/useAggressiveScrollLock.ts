"use client";

import { useEffect } from "react";

/**
 * Aggressive mobile scroll lock to keep focus on the writing surface.
 * Centralized to avoid duplicate implementations across pages.
 */
export function useAggressiveScrollLock() {
	useEffect(() => {
		const originalBodyOverflow = document.body.style.overflow;
		const originalBodyClasses = document.body.className;
		const originalDocumentElementOverflow =
			document.documentElement.style.overflow;
		const originalBodyPosition = document.body.style.position;

		// CSS-based scroll lock
		document.body.style.overflow = "hidden";
		document.body.style.position = "fixed";
		document.body.style.width = "100%";
		document.body.style.height = "100%";
		document.documentElement.style.overflow = "hidden";
		document.body.classList.add("full-vh");

		// JavaScript-based scroll prevention for stubborn mobile browsers
		const preventScroll = (e: TouchEvent | WheelEvent) => {
			const target = e.target as HTMLElement;

			// Allow scrolling only on textarea and scrollable elements
			if (target.tagName === "TEXTAREA" || target.closest(".scrollable")) {
				return;
			}

			// Prevent all other scrolling
			e.preventDefault();
		};

		const preventKeyboardScroll = (e: KeyboardEvent) => {
			// Prevent arrow keys, page up/down, etc. from scrolling the page
			if (
				[
					"ArrowUp",
					"ArrowDown",
					"PageUp",
					"PageDown",
					"Home",
					"End",
					"Space",
				].includes(e.key)
			) {
				const target = e.target as HTMLElement;
				if (target.tagName !== "TEXTAREA") {
					e.preventDefault();
				}
			}
		};

		const preventContext = (e: Event) => e.preventDefault();

		// Add passive: false to ensure preventDefault works
		document.addEventListener("touchmove", preventScroll, { passive: false });
		document.addEventListener("wheel", preventScroll, { passive: false });
		document.addEventListener("keydown", preventKeyboardScroll);
		document.addEventListener("contextmenu", preventContext as any);

		return () => {
			document.body.style.overflow = originalBodyOverflow;
			document.body.style.position = originalBodyPosition;
			document.body.style.width = "";
			document.body.style.height = "";
			document.documentElement.style.overflow = originalDocumentElementOverflow;
			document.body.className = originalBodyClasses;

			document.removeEventListener("touchmove", preventScroll as any);
			document.removeEventListener("wheel", preventScroll as any);
			document.removeEventListener("keydown", preventKeyboardScroll as any);
			document.removeEventListener("contextmenu", preventContext as any);
		};
	}, []);
}

