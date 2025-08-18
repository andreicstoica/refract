import { openai } from "@ai-sdk/openai";
import { embedMany, cosineSimilarity } from "ai";
import type { Sentence } from "./sentenceUtils";

export interface TextChunk {
  id: string;
  text: string;
  sentenceId: string;
  embedding?: number[];
}

export interface EmbeddingResult {
  chunks: TextChunk[];
  embeddings: number[][];
  usage: {
    tokens: number;
    cost?: number;
  };
}

export interface ClusterResult {
  id: string;
  label: string;
  chunks: TextChunk[];
  centroid: number[];
  confidence: number;
}

/**
 * Convert filtered sentences to text chunks ready for embedding
 */
export function sentencesToChunks(sentences: Sentence[]): TextChunk[] {
  return sentences.map((sentence) => ({
    id: `chunk-${sentence.id}`,
    text: sentence.text,
    sentenceId: sentence.id,
  }));
}

/**
 * Generate embeddings for text chunks using Vercel AI SDK
 */
export async function generateEmbeddings(
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

/**
 * Calculate similarity matrix for embeddings
 */
export function calculateSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = similarity;
      matrix[j][i] = similarity; // Symmetric matrix
    }
  }

  return matrix;
}

/**
 * Simple k-means clustering for embeddings
 */
export function clusterEmbeddings(
  chunks: TextChunk[],
  embeddings: number[][],
  k: number = 3
): ClusterResult[] {
  if (chunks.length < k) {
    // Not enough chunks for clustering, return single cluster
    return [{
      id: "cluster-0",
      label: "Main Theme",
      chunks: chunks,
      centroid: embeddings[0] || [],
      confidence: 1.0,
    }];
  }

  // K-means clustering implementation
  const maxIterations = 10;
  const n = embeddings.length;
  
  // Step 1: Initialize centroids - use first k embeddings as starting points
  let centroids: number[][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push([...embeddings[i % n]]); // Use modulo to handle k > n case
  }
  
  let assignments = new Array(n).fill(0);
  let converged = false;
  
  for (let iteration = 0; iteration < maxIterations && !converged; iteration++) {
    const previousAssignments = [...assignments];
    
    // Step 2: Assign each embedding to nearest centroid
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestSimilarity = cosineSimilarity(embeddings[i], centroids[0]);
      
      for (let j = 1; j < k; j++) {
        const similarity = cosineSimilarity(embeddings[i], centroids[j]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = j;
        }
      }
      
      assignments[i] = bestCluster;
    }
    
    // Step 3: Update centroids based on assignments
    for (let cluster = 0; cluster < k; cluster++) {
      const clusterEmbeddings = embeddings.filter((_, i) => assignments[i] === cluster);
      if (clusterEmbeddings.length > 0) {
        centroids[cluster] = calculateCentroid(clusterEmbeddings);
      }
    }
    
    // Check for convergence (assignments didn't change)
    converged = assignments.every((assignment, i) => assignment === previousAssignments[i]);
  }
  
  // Step 4: Build final clusters
  const clusters: ClusterResult[] = [];
  for (let cluster = 0; cluster < k; cluster++) {
    const clusterChunks = chunks.filter((_, i) => assignments[i] === cluster);
    
    if (clusterChunks.length === 0) continue;
    
    // Calculate confidence as average similarity to centroid
    const clusterEmbeddings = embeddings.filter((_, i) => assignments[i] === cluster);
    const avgSimilarity = clusterEmbeddings.reduce((sum, embedding) => 
      sum + cosineSimilarity(embedding, centroids[cluster]), 0) / clusterEmbeddings.length;
    
    clusters.push({
      id: `cluster-${cluster}`,
      label: `Theme ${cluster + 1}`,
      chunks: clusterChunks,
      centroid: centroids[cluster],
      confidence: avgSimilarity,
    });
  }

  return clusters;
}

/**
 * Calculate centroid (mean vector) of embeddings
 */
function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dimensions = embeddings[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += embedding[i];
    }
  }

  // Average
  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Find most similar chunks to a given embedding
 */
export function findSimilarChunks(
  targetEmbedding: number[],
  chunks: TextChunk[],
  limit: number = 5
): Array<{ chunk: TextChunk; similarity: number }> {
  if (!chunks.length || !targetEmbedding.length) return [];

  const similarities = chunks
    .filter(chunk => chunk.embedding)
    .map(chunk => ({
      chunk,
      similarity: cosineSimilarity(targetEmbedding, chunk.embedding!),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return similarities;
}