import { describe, test, expect, beforeEach } from "bun:test";
import {
  sentencesToChunks,
  calculateSimilarityMatrix,
  clusterEmbeddings,
  findSimilarChunks,
} from "@/utils/embeddingUtils";
import type { Sentence } from "@/types/sentence";
import type { TextChunk } from "@/types/embedding";

describe("embeddingUtils", () => {
  let mockSentences: Sentence[];
  let mockEmbeddings: number[][];

  beforeEach(() => {
    mockSentences = [
      {
        id: "sentence-0",
        text: "I had a great day at work today.",
        startIndex: 0,
        endIndex: 30,
      },
      {
        id: "sentence-1", 
        text: "The weather was beautiful and sunny.",
        startIndex: 31,
        endIndex: 67,
      },
      {
        id: "sentence-2",
        text: "I feel stressed about my upcoming presentation.",
        startIndex: 68,
        endIndex: 115,
      },
    ];

    // Mock embeddings: similar content should have similar vectors
    mockEmbeddings = [
      [0.8, 0.2, 0.1], // Positive work sentiment
      [0.2, 0.8, 0.1], // Weather/nature
      [0.1, 0.2, 0.8], // Stress/anxiety
    ];
  });

  describe("sentencesToChunks", () => {
    test("converts sentences to text chunks correctly", () => {
      const chunks = sentencesToChunks(mockSentences);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({
        id: "chunk-sentence-0",
        text: "I had a great day at work today.",
        sentenceId: "sentence-0",
      });
      expect(chunks[1].sentenceId).toBe("sentence-1");
      expect(chunks[2].sentenceId).toBe("sentence-2");
    });

    test("handles empty sentences array", () => {
      const chunks = sentencesToChunks([]);
      expect(chunks).toEqual([]);
    });
  });

  describe("calculateSimilarityMatrix", () => {
    test("creates symmetric similarity matrix", () => {
      const matrix = calculateSimilarityMatrix(mockEmbeddings);
      
      expect(matrix).toHaveLength(3);
      expect(matrix[0]).toHaveLength(3);
      
      // Matrix should be symmetric
      expect(matrix[0][1]).toBe(matrix[1][0]);
      expect(matrix[0][2]).toBe(matrix[2][0]);
      expect(matrix[1][2]).toBe(matrix[2][1]);
      
      // Diagonal should be 1.0 (self-similarity)
      expect(matrix[0][0]).toBeCloseTo(1.0, 5);
      expect(matrix[1][1]).toBeCloseTo(1.0, 5);
      expect(matrix[2][2]).toBeCloseTo(1.0, 5);
    });

    test("handles empty embeddings", () => {
      const matrix = calculateSimilarityMatrix([]);
      expect(matrix).toEqual([]);
    });
  });

  describe("clusterEmbeddings", () => {
    test("creates specified number of clusters", () => {
      const chunks = sentencesToChunks(mockSentences);
      const clusters = clusterEmbeddings(chunks, mockEmbeddings, 2);
      
      expect(clusters).toHaveLength(2);
      expect(clusters[0].id).toMatch(/^cluster-\d+$/);
      expect(clusters[0].chunks.length).toBeGreaterThan(0);
      expect(clusters[0].centroid).toHaveLength(3);
      expect(clusters[0].confidence).toBeGreaterThan(0);
    });

    test("handles more clusters than chunks", () => {
      const chunks = sentencesToChunks(mockSentences.slice(0, 1)); // Only 1 sentence
      const clusters = clusterEmbeddings(chunks, [mockEmbeddings[0]], 3);
      
      expect(clusters).toHaveLength(1);
      expect(clusters[0].label).toBe("Main Theme");
      expect(clusters[0].confidence).toBe(1.0);
    });

    test("assigns all chunks to clusters", () => {
      const chunks = sentencesToChunks(mockSentences);
      const clusters = clusterEmbeddings(chunks, mockEmbeddings, 2);
      
      const totalAssignedChunks = clusters.reduce((sum, cluster) => sum + cluster.chunks.length, 0);
      expect(totalAssignedChunks).toBe(chunks.length);
    });

    test("clusters have valid confidence scores", () => {
      const chunks = sentencesToChunks(mockSentences);
      const clusters = clusterEmbeddings(chunks, mockEmbeddings, 2);
      
      clusters.forEach(cluster => {
        expect(cluster.confidence).toBeGreaterThanOrEqual(0);
        expect(cluster.confidence).toBeLessThanOrEqual(1.01); // Allow small floating-point tolerance
      });
    });
  });

  describe("findSimilarChunks", () => {
    test("finds most similar chunks in order", () => {
      const chunks = sentencesToChunks(mockSentences);
      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: mockEmbeddings[i],
      }));
      
      const targetEmbedding = [0.7, 0.3, 0.1]; // Similar to first embedding
      const similar = findSimilarChunks(targetEmbedding, chunksWithEmbeddings, 2);
      
      expect(similar).toHaveLength(2);
      expect(similar[0].similarity).toBeGreaterThan(similar[1].similarity);
      expect(similar[0].chunk.sentenceId).toBe("sentence-0"); // Most similar should be first
    });

    test("handles empty chunks array", () => {
      const similar = findSimilarChunks([0.5, 0.5, 0.5], [], 5);
      expect(similar).toEqual([]);
    });

    test("respects limit parameter", () => {
      const chunks = sentencesToChunks(mockSentences);
      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: mockEmbeddings[i],
      }));
      
      const similar = findSimilarChunks([0.5, 0.5, 0.5], chunksWithEmbeddings, 1);
      expect(similar).toHaveLength(1);
    });
  });

  describe("k-means convergence", () => {
    test("converges for well-separated clusters", () => {
      // Create clearly separated embeddings
      const separatedEmbeddings = [
        [1.0, 0.0, 0.0], // Cluster 1
        [0.9, 0.1, 0.0], // Cluster 1
        [0.0, 1.0, 0.0], // Cluster 2  
        [0.1, 0.9, 0.0], // Cluster 2
      ];

      const testSentences = Array.from({ length: 4 }, (_, i) => ({
        id: `sentence-${i}`,
        text: `Test sentence ${i}`,
        startIndex: i * 20,
        endIndex: (i + 1) * 20,
      }));

      const chunks = sentencesToChunks(testSentences);
      const clusters = clusterEmbeddings(chunks, separatedEmbeddings, 2);
      
      expect(clusters).toHaveLength(2);
      
      // Each cluster should have 2 chunks for well-separated data
      expect(clusters[0].chunks.length).toBe(2);
      expect(clusters[1].chunks.length).toBe(2);
      
      // Confidence should be high for well-separated clusters
      clusters.forEach(cluster => {
        expect(cluster.confidence).toBeGreaterThan(0.7);
      });
    });
  });
});