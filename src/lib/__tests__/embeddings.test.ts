import { describe, it, expect } from "bun:test";
import { sentencesToChunks, attachEmbeddingsToChunks, calculateSimilarityMatrix, clusterEmbeddings } from "@/lib/clustering";
import type { Sentence } from "@/types/sentence";

const sampleSentences: Sentence[] = [
	{ id: "s1", text: "First sentence.", startIndex: 0, endIndex: 15 },
	{ id: "s2", text: "Second thought.", startIndex: 16, endIndex: 31 },
];

describe("embeddings helpers", () => {
	it("converts sentences to chunks with ids", () => {
		const chunks = sentencesToChunks(sampleSentences);
		expect(chunks).toEqual([
			{ id: "chunk-s1", text: "First sentence.", sentenceId: "s1" },
			{ id: "chunk-s2", text: "Second thought.", sentenceId: "s2" },
		]);
	});

	it("attaches embeddings to existing chunks by index", () => {
		const chunks = sentencesToChunks(sampleSentences);
		const withEmbeddings = attachEmbeddingsToChunks(chunks, [
			[1, 0],
			[0, 1],
		]);
		expect(withEmbeddings[0].embedding).toEqual([1, 0]);
		expect(withEmbeddings[1].embedding).toEqual([0, 1]);
	});

	it("builds cosine similarity matrices", () => {
		const matrix = calculateSimilarityMatrix([
			[1, 0],
			[0, 1],
		]);
		expect(matrix[0][0]).toBe(1);
		expect(matrix[1][1]).toBe(1);
		expect(matrix[0][1]).toBeCloseTo(0, 5);
		expect(matrix[1][0]).toBeCloseTo(0, 5);
	});

	it("clusters embeddings deterministically when provided with a custom RNG", () => {
		const chunks = [
			{ id: "c1", text: "one", sentenceId: "s1" },
			{ id: "c2", text: "two", sentenceId: "s2" },
			{ id: "c3", text: "three", sentenceId: "s3" },
			{ id: "c4", text: "four", sentenceId: "s4" },
		];

		const embeddings = [
			[1, 0],
			[0.9, 0.1],
			[0, 1],
			[0.1, 0.9],
		];

		const randomValues = [0.1, 0.25];
		const rng = () => randomValues.shift() ?? 0.5;

		const clusters = clusterEmbeddings(chunks, embeddings, 2, rng);
		expect(clusters).toHaveLength(2);
		expect(clusters[0].chunks.length + clusters[1].chunks.length).toBe(4);
		expect(clusters[0].chunks[0]).toHaveProperty("correlation");
	});

	it("returns a single cluster when there are fewer chunks than k", () => {
		const chunks = [{ id: "c1", text: "solo", sentenceId: "s1" }];
		const embeddings = [[0.4, 0.9]];

		const clusters = clusterEmbeddings(chunks, embeddings, 3);
		expect(clusters).toHaveLength(1);
		expect(clusters[0].label).toBe("Main Theme");
		expect(clusters[0].confidence).toBe(1);
	});
});
