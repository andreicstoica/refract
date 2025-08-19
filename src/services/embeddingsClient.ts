import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import type { EmbeddingsRequest, EmbeddingsResponse } from "@/types/api";
import type { TextChunk, EmbeddingResult } from "@/types/embedding";

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

/**
 * Generate embeddings for text chunks using Vercel AI SDK
 * This handles the OpenAI API integration at the service layer
 */
export async function generateEmbeddingVectors(
  chunks: TextChunk[]
): Promise<EmbeddingResult> {
  if (chunks.length === 0) {
    return {
      chunks: [],
      embeddings: [],
      usage: { tokens: 0, cost: 0 },
    };
  }

  try {
    const texts = chunks.map((chunk) => chunk.text);

    const result = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: texts,
    });

    // Attach embeddings to chunks
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: result.embeddings[index],
    }));

    return {
      chunks: chunksWithEmbeddings,
      embeddings: result.embeddings,
      usage: {
        tokens: result.usage?.tokens || 0,
        cost: (result.usage?.tokens || 0) * 0.00002, // Approximate cost for text-embedding-3-small
      },
    };
  } catch (error) {
    console.error("❌ Embedding generation failed:", error);
    throw new Error("Failed to generate embeddings");
  }
}
