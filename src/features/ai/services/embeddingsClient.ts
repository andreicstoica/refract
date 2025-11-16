import type { EmbeddingsRequest, EmbeddingsResponse } from "@/types/api";
/**
 * Generate embeddings and theme analysis for the given sentences
 */
export async function generateEmbeddings(input: EmbeddingsRequest): Promise<EmbeddingsResponse> {
  const response = await fetch("/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Embeddings API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
