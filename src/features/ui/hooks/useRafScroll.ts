import React from "react";
import { debug } from "@/lib/debug";

/**
 * RAF-based scroll helper that polls the textarea's scroll position every frame.
 * This keeps overlays perfectly in sync even when the browser batches scroll
 * events (e.g., high refresh-rate trackpads) by reacting directly inside the
 * animation loop.
 */

type ScrollHandler = (element: HTMLElement) => void;

interface ScrollSubscription {
	element: HTMLElement;
	handlers: Set<ScrollHandler>;
	rafId: number | null;
	lastScrollTop: number;
	lastScrollLeft: number;
}

const subscriptions = new Map<HTMLElement, ScrollSubscription>();
const HAS_WINDOW = typeof window !== "undefined";
const HAS_RAF = HAS_WINDOW && typeof window.requestAnimationFrame === "function";
const HAS_CAF = HAS_WINDOW && typeof window.cancelAnimationFrame === "function";

function runHandlers(subscription: ScrollSubscription) {
	subscription.handlers.forEach((handler) => {
		try {
			handler(subscription.element);
		} catch (error) {
			debug.error("Error in scroll handler:", error);
		}
	});
}

function step(subscription: ScrollSubscription) {
	if (!HAS_RAF) {
		// When RAF isn't available (SSR/tests), run once and bail.
		runHandlers(subscription);
		return;
	}

	const loop = () => {
		const { element } = subscription;
		const nextTop = element.scrollTop;
		const nextLeft = element.scrollLeft;

		if (
			nextTop !== subscription.lastScrollTop ||
			nextLeft !== subscription.lastScrollLeft
		) {
			subscription.lastScrollTop = nextTop;
			subscription.lastScrollLeft = nextLeft;
			runHandlers(subscription);
		}

		if (subscription.handlers.size > 0) {
			subscription.rafId = window.requestAnimationFrame(loop);
		} else {
			subscription.rafId = null;
		}
	};

	// Kick off the loop immediately so we process any existing scroll offset.
	loop();
}

function ensureLoop(subscription: ScrollSubscription) {
	if (!HAS_WINDOW) {
		runHandlers(subscription);
		return;
	}

	if (subscription.rafId != null) return;
	step(subscription);
}

/**
 * Subscribe to scroll updates driven by RAF polling.
 */
export function subscribe(element: HTMLElement, handler: ScrollHandler): () => void {
	let subscription = subscriptions.get(element);

	if (!subscription) {
		subscription = {
			element,
			handlers: new Set(),
			rafId: null,
			lastScrollTop: element.scrollTop,
			lastScrollLeft: element.scrollLeft,
		};
		subscriptions.set(element, subscription);
	}

	subscription.handlers.add(handler);
	// Immediate sync so overlays line up before the next frame.
	handler(element);
	ensureLoop(subscription);

	return () => {
		const current = subscriptions.get(element);
		if (!current) return;

		current.handlers.delete(handler);
		if (current.handlers.size === 0) {
			if (current.rafId != null && HAS_CAF) {
				window.cancelAnimationFrame(current.rafId);
				current.rafId = null;
			}
			subscriptions.delete(element);
		}
	};
}

/**
 * Hook version for easy React integration
 * @param elementRef - Ref to the element to listen for scroll events on
 * @param handler - The callback function to execute on scroll
 * @param deps - Dependencies array (similar to useEffect)
 */
export function useRafScroll<T extends HTMLElement>(
	elementRef: React.RefObject<T | null> | undefined,
	handler: ScrollHandler,
	deps: React.DependencyList = []
) {
	const stableHandler = React.useCallback(handler, deps);

	React.useEffect(() => {
		if (!elementRef) return;
		const element = elementRef.current;
		if (!element) return;

		return subscribe(element, stableHandler);
	}, [elementRef, stableHandler]);
}
