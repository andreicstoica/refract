import React from "react";
import { debug } from "@/lib/debug";

/**
 * RAF-based scroll coalescing helper
 * 
 * Batches scroll callbacks to 1/frame using requestAnimationFrame to reduce
 * main-thread work and improve scroll performance on mobile devices.
 * 
 * Usage:
 * ```ts
 * useEffect(() => {
 *   if (!elementRef.current) return;
 *   
 *   return subscribe(elementRef.current, (element) => {
 *     // Your scroll handler logic here (dev-only logging via debug helper)
 *     debug.dev('Scroll position:', element.scrollTop);
 *   });
 * }, []);
 * ```
 */

type ScrollHandler = (element: HTMLElement) => void;

interface ScrollSubscription {
    element: HTMLElement;
    handlers: Set<ScrollHandler>;
    rafId: number | null;
    isScheduled: boolean;
}

// Global map to track subscriptions per element
const subscriptions = new Map<HTMLElement, ScrollSubscription>();

function executeHandlers(subscription: ScrollSubscription) {
    subscription.rafId = null;
    subscription.isScheduled = false;

    // Execute all handlers for this element
    subscription.handlers.forEach(handler => {
        try {
            handler(subscription.element);
        } catch (error) {
            debug.error('Error in scroll handler:', error);
        }
    });
}

function scheduleUpdate(subscription: ScrollSubscription) {
    if (subscription.isScheduled) return;

    subscription.isScheduled = true;
    subscription.rafId = requestAnimationFrame(() => executeHandlers(subscription));
}

function handleScroll(this: HTMLElement) {
    const subscription = subscriptions.get(this);
    if (subscription) {
        scheduleUpdate(subscription);
    }
}

/**
 * Subscribe to scroll events with RAF coalescing
 * @param element - The element to listen for scroll events on
 * @param handler - The callback function to execute on scroll
 * @returns Cleanup function to remove the subscription
 */
export function subscribe(element: HTMLElement, handler: ScrollHandler): () => void {
    let subscription = subscriptions.get(element);

    if (!subscription) {
        subscription = {
            element,
            handlers: new Set(),
            rafId: null,
            isScheduled: false,
        };
        subscriptions.set(element, subscription);

        // Add the actual DOM event listener (passive for performance)
        element.addEventListener('scroll', handleScroll, { passive: true });
    }

    subscription.handlers.add(handler);

    // Return cleanup function
    return () => {
        const currentSubscription = subscriptions.get(element);
        if (!currentSubscription) return;

        currentSubscription.handlers.delete(handler);

        // If no more handlers, clean up completely
        if (currentSubscription.handlers.size === 0) {
            if (currentSubscription.rafId) {
                cancelAnimationFrame(currentSubscription.rafId);
            }
            element.removeEventListener('scroll', handleScroll);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableHandler = React.useCallback(handler, deps);

    React.useEffect(() => {
        if (!elementRef) return;
        const element = elementRef.current;
        if (!element) return;

        return subscribe(element, stableHandler);
    }, [elementRef, stableHandler]);
}
