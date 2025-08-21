import { cosineSimilarity } from "ai";
import type { Sentence } from "@/types/sentence";
import type { TextChunk, EmbeddingResult, ClusterResult } from "@/types/embedding";

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
 * Attach embeddings to text chunks (pure function)
 */
export function attachEmbeddingsToChunks(
  chunks: TextChunk[],
  embeddings: number[][]
): TextChunk[] {
  return chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
  }));
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

  // Step 1: Initialize centroids - use k-means++ initialization for better results
  let centroids: number[][] = [];

  // K-means++ initialization
  centroids.push([...embeddings[Math.floor(Math.random() * n)]]);

  for (let i = 1; i < k; i++) {
    const distances = embeddings.map(embedding => {
      const minDistance = Math.min(...centroids.map(centroid =>
        1 - cosineSimilarity(embedding, centroid)
      ));
      return minDistance;
    });

    const totalDistance = distances.reduce((sum, d) => sum + d, 0);
    let random = Math.random() * totalDistance;
    let selectedIndex = 0;

    for (let j = 0; j < n; j++) {
      random -= distances[j];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    centroids.push([...embeddings[selectedIndex]]);
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

  // Step 4: Build final clusters and filter out empty ones
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
      label: `Cluster ${cluster + 1}`, // Will be replaced by AI labeling
      chunks: clusterChunks,
      centroid: centroids[cluster],
      confidence: avgSimilarity,
    });
  }

  // Sort clusters by size and confidence to prioritize meaningful ones
  return clusters.sort((a, b) => (b.chunks.length * b.confidence) - (a.chunks.length * a.confidence));
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

/**
 * Merge clusters that have the same theme label
 */
export function mergeClustersByTheme(
  clusters: ClusterResult[],
  themeLabels: Array<{ clusterId: string; label: string; description: string; confidence: number; color: string }>
): ClusterResult[] {
  if (clusters.length === 0) return [];

  // Create a map of theme labels to clusters
  const themeMap = new Map<string, ClusterResult[]>();

  clusters.forEach((cluster, index) => {
    const themeLabel = themeLabels.find(t => t.clusterId === cluster.id);
    const label = themeLabel?.label || cluster.label;

    if (!themeMap.has(label)) {
      themeMap.set(label, []);
    }
    themeMap.get(label)!.push(cluster);
  });

  // Merge clusters with the same theme
  const mergedClusters: ClusterResult[] = [];

  themeMap.forEach((clustersWithSameTheme, themeLabel) => {
    if (clustersWithSameTheme.length === 1) {
      // Single cluster, just update the label
      const cluster = clustersWithSameTheme[0];
      const themeLabelData = themeLabels.find(t => t.clusterId === cluster.id);
      mergedClusters.push({
        ...cluster,
        label: themeLabel,
        description: themeLabelData?.description || cluster.description || "",
        confidence: themeLabelData?.confidence || cluster.confidence,
        color: themeLabelData?.color || cluster.color,
      });
    } else {
      // Multiple clusters with same theme, merge them
      const allChunks = clustersWithSameTheme.flatMap(c => c.chunks);
      const allEmbeddings = clustersWithSameTheme.flatMap(c =>
        c.chunks.map(chunk => chunk.embedding).filter((embedding): embedding is number[] => !!embedding)
      );

      // Calculate new centroid from all embeddings
      const newCentroid = calculateCentroid(allEmbeddings);

      // Calculate average confidence
      const avgConfidence = clustersWithSameTheme.reduce((sum, c) => sum + c.confidence, 0) / clustersWithSameTheme.length;

      // Get theme data from the first cluster
      const themeLabelData = themeLabels.find(t => t.clusterId === clustersWithSameTheme[0].id);

      mergedClusters.push({
        id: `merged-${themeLabel.toLowerCase().replace(/\s+/g, '-')}`,
        label: themeLabel,
        chunks: allChunks,
        centroid: newCentroid,
        confidence: avgConfidence,
        description: themeLabelData?.description || "Related thoughts",
        color: themeLabelData?.color || "#3B82F6",
      });
    }
  });

  // Sort by confidence and chunk count
  return mergedClusters.sort((a, b) => (b.confidence * b.chunks.length) - (a.confidence * a.chunks.length));
}

