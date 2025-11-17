import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import type { TextChunk, EmbeddingResult } from "@/types/embedding";
import { debug } from "@/lib/debug";

/**
 * Generate embeddings for text chunks using OpenAI's text-embedding-3-small model
 * This is the backend service that actually calls OpenAI
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

        // Keep chunks + embeddings paired for downstream metrics/telemetry
        const chunksWithEmbeddings = chunks.map((chunk, index) => ({
            ...chunk,
            embedding: result.embeddings[index],
        }));

        return {
            chunks: chunksWithEmbeddings,
            embeddings: result.embeddings,
            usage: {
                tokens: result.usage?.tokens || 0,
                cost: (result.usage?.tokens || 0) * 0.00002, // text-embedding-3-small pricing
            },
        };
    } catch (error) {
        debug.error("❌ Embedding generation failed:", error);
        throw new Error("Failed to generate embeddings");
    }
}

