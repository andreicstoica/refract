import type { ProdRequest, ProdResponse } from "@/types/api";

/**
 * Generate a prod suggestion for the given text input
 */
export async function generateProd(input: ProdRequest): Promise<ProdResponse> {
    const response = await fetch("/api/prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        throw new Error(`Prod API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
