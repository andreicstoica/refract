import type { ProdRequest, ProdResponse } from "@/types/api";

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds (2s less than server timeout)

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
        response = await fetch("/api/prod", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            signal: opts?.signal,
        });

        const elapsedToHeaders = getNow() - start;
        if (!response.ok) {
            console.warn(`⏱️ /api/prod failed in ${Math.round(elapsedToHeaders)}ms: ${response.status} ${response.statusText}`);
            throw new Error(`Prod API call failed: ${response.status} ${response.statusText}`);
        }

        const data: ProdResponse = await response.json();
        const totalElapsed = getNow() - start;

        console.log(`⏱️ /api/prod completed in ${Math.round(totalElapsed)}ms`, {
            selectedLen: typeof data?.selectedProd === "string" ? data.selectedProd.length : 0,
            confidence: data?.confidence ?? null,
        });

        return data;
    } catch (error) {
        const elapsed = getNow() - start;

        // Check if it was an abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn(`⏱️ /api/prod timed out after ${Math.round(elapsed)}ms (soft-skip)`);
            // Soft-skip on timeout so upstream can continue without error noise
            const softSkip: ProdResponse = { selectedProd: "" };
            return softSkip;
        }

        console.error(`⏱️ /api/prod error after ${Math.round(elapsed)}ms`, error);
        throw error;
    }
}
