import { debug } from "@/lib/debug";
import type { ProdRequest, ProdResponse } from "@/types/api";

// Keep aligned with server maxDuration (15s) with a tiny buffer
const REQUEST_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Generate a prod suggestion with built-in timeout and cancellation support
 */
export async function generateProdWithTimeout(
    input: ProdRequest,
    opts?: { signal?: AbortSignal }
): Promise<ProdResponse> {
    // Create AbortController for timeout if not provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    // Combine with external signal if provided
    let combinedSignal: AbortSignal;
    if (opts?.signal) {
        // If both signals exist, abort when either one is aborted
        opts.signal.addEventListener('abort', () => controller.abort());
        combinedSignal = controller.signal;
    } else {
        combinedSignal = controller.signal;
    }

    try {
        return await generateProd(input, { signal: combinedSignal });
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Generate a prod suggestion for the given text input
 */
export async function generateProd(
    input: ProdRequest,
    opts?: { signal?: AbortSignal }
): Promise<ProdResponse> {
    const getNow = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const start = getNow();
    let response: Response | undefined;

    try {
        // Add demo mode detection
        const isDemoMode = typeof window !== 'undefined' && window.location.pathname === '/demo';

        response = await fetch("/api/prod", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Demo-Mode": isDemoMode ? "true" : "false"
            },
            body: JSON.stringify(input),
            signal: opts?.signal,
        });

        const elapsedToHeaders = getNow() - start;
        if (!response.ok) {
            debug.dev(`⏱️ /api/prod failed in ${Math.round(elapsedToHeaders)}ms: ${response.status} ${response.statusText}`);
            throw new Error(`Prod API call failed: ${response.status} ${response.statusText}`);
        }

        const data: ProdResponse = await response.json();
        const totalElapsed = getNow() - start;

        debug.dev(`⏱️ /api/prod completed in ${Math.round(totalElapsed)}ms`, {
            selectedLen: typeof data?.selectedProd === "string" ? data.selectedProd.length : 0,
            confidence: data?.confidence ?? null,
        });

        return data;
    } catch (error) {
        const elapsed = getNow() - start;

        // Check if it was an abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
            debug.dev(`⏱️ /api/prod timed out after ${Math.round(elapsed)}ms (soft-skip)`);
            // Soft skip: do not surface a chip on timeout
            const softSkip: ProdResponse = { confidence: 0 };
            return softSkip;
        }

        debug.dev(`⏱️ /api/prod error after ${Math.round(elapsed)}ms`, error);
        throw error;
    }
}
