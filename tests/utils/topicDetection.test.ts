import { describe, it, expect } from "bun:test";
import { extractKeywords, jaccardOverlap, updateTopicState } from "@/lib/topic";

describe("topicDetection", () => {
    describe("extractKeywords", () => {
        it("extracts meaningful keywords from text", () => {
            const text = "I had a really productive day at work today. The meeting went well and I finished all my tasks.";
            const keywords = extractKeywords(text);

            expect(keywords.length).toBeGreaterThan(0);
            expect(Array.isArray(keywords)).toBe(true);
        });

        it("handles empty text", () => {
            const keywords = extractKeywords("");
            expect(keywords).toEqual([]);
        });

        it("handles text with punctuation", () => {
            const text = "Hello, world! How are you today?";
            const keywords = extractKeywords(text);

            expect(keywords.length).toBeGreaterThan(0);
            expect(Array.isArray(keywords)).toBe(true);
        });

        it("respects keyword limit", () => {
            const longText = "This is a very long text with many different words and concepts that should be limited to prevent performance issues. We want to make sure that the keyword extraction doesn't return too many results.";
            const keywords = extractKeywords(longText);

            expect(keywords.length).toBeLessThanOrEqual(15); // DEFAULTS.keywordLimit
        });
    });

    describe("jaccardOverlap", () => {
        it("calculates correct Jaccard similarity", () => {
            const setA = ["a", "b", "c"];
            const setB = ["b", "c", "d"];

            const overlap = jaccardOverlap(setA, setB);

            // Intersection: {b, c} = 2 elements
            // Union: {a, b, c, d} = 4 elements
            // Jaccard = 2/4 = 0.5
            expect(overlap).toBe(0.5);
        });

        it("handles identical arrays", () => {
            const setA = ["a", "b", "c"];
            const setB = ["a", "b", "c"];

            const overlap = jaccardOverlap(setA, setB);
            expect(overlap).toBe(1.0);
        });

        it("handles disjoint arrays", () => {
            const setA = ["a", "b", "c"];
            const setB = ["d", "e", "f"];

            const overlap = jaccardOverlap(setA, setB);
            expect(overlap).toBe(0.0);
        });

        it("handles empty arrays", () => {
            const setA: string[] = [];
            const setB = ["a", "b"];

            const overlap = jaccardOverlap(setA, setB);
            expect(overlap).toBe(0.0);
        });

        it("handles both empty arrays", () => {
            const setA: string[] = [];
            const setB: string[] = [];

            const overlap = jaccardOverlap(setA, setB);
            expect(overlap).toBe(1.0); // Empty arrays are considered identical
        });
    });

    describe("updateTopicState", () => {
        it("detects topic shift when overlap is low for consecutive updates", () => {
            const currentKeywords = ["work", "meeting", "productivity"];
            const state = {
                keywords: ["family", "vacation", "relaxation"],
                emaOverlap: 0.1, // Start with low overlap
                lowCount: 1, // Already had one low overlap
                lastUpdate: Date.now(),
            };

            const result = updateTopicState(currentKeywords, state);
            expect(result.shift).toBe(true); // Should shift because lowCount >= minConsecutive (2)
        });

        it("does not detect shift on first low overlap", () => {
            const currentKeywords = ["work", "meeting", "productivity"];
            const state = {
                keywords: ["family", "vacation", "relaxation"],
                emaOverlap: 0.8,
                lowCount: 0, // First low overlap
                lastUpdate: Date.now(),
            };

            const result = updateTopicState(currentKeywords, state);
            expect(result.shift).toBe(false); // Should not shift because lowCount < minConsecutive (2)
        });

        it("does not detect shift when overlap is high", () => {
            const currentKeywords = ["work", "meeting", "productivity"];
            const state = {
                keywords: ["work", "office", "productivity"],
                emaOverlap: 0.8,
                lowCount: 0,
                lastUpdate: Date.now(),
            };

            const result = updateTopicState(currentKeywords, state);
            expect(result.shift).toBe(false);
        });

        it("handles empty keyword arrays", () => {
            const state = {
                keywords: ["work", "meeting"],
                emaOverlap: 0.5,
                lowCount: 1, // Need to have had a previous low overlap
                lastUpdate: Date.now(),
            };

            const result = updateTopicState([], state);
            expect(result.shift).toBe(true); // Empty current keywords should trigger shift after consecutive low overlaps
        });

        it("updates state correctly", () => {
            const currentKeywords = ["work", "meeting"];
            const state = {
                keywords: ["work", "office"],
                emaOverlap: 0.5,
                lowCount: 0,
                lastUpdate: Date.now() - 1000, // Use a different timestamp
            };

            const result = updateTopicState(currentKeywords, state);
            expect(result.state.keywords).toEqual(currentKeywords);
            expect(result.state.lastUpdate).toBeGreaterThan(state.lastUpdate);
        });
    });
});
