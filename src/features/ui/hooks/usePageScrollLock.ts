"use client";

import { useEffect } from "react";

/**
 * Simple page scroll lock to prevent double scrollbars.
 * Only prevents page-level scrolling while allowing textarea scrolling.
 */
export function usePageScrollLock() {
    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalDocumentElementOverflow = document.documentElement.style.overflow;

        // Simple CSS-based scroll lock - just prevent page scrolling
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalDocumentElementOverflow;
        };
    }, []);
}
