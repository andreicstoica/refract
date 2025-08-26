import { describe, it, expect } from "bun:test";
import { splitIntoClosedChunks } from "@/lib/chunk";

describe("chunkUtils", () => {
    it("splits text into closed chunks correctly", () => {
        const text = "First sentence. Second sentence. Third sentence.";
        const chunks = splitIntoClosedChunks(text, { minWindow: 10, maxWindow: 30 });

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].text).toBeDefined();
        expect(chunks[0].start).toBe(0);
        expect(chunks[0].end).toBeGreaterThan(0);
    });

    it("handles empty text", () => {
        const chunks = splitIntoClosedChunks("");
        expect(chunks).toHaveLength(0);
    });

    it("respects minWindow and maxWindow options", () => {
        const text = "This is a very long sentence that should be split into multiple chunks based on the window size configuration.";
        const chunks = splitIntoClosedChunks(text, { minWindow: 20, maxWindow: 40 });

        chunks.forEach(chunk => {
            const chunkLength = chunk.text.length;
            expect(chunkLength).toBeGreaterThanOrEqual(20);
            expect(chunkLength).toBeLessThanOrEqual(40);
        });
    });

    it("splits on punctuation boundaries", () => {
        const text = "First part, second part; third part: fourth part.";
        const chunks = splitIntoClosedChunks(text, { minWindow: 10, maxWindow: 25 });

        expect(chunks.length).toBeGreaterThan(1);
        // Should split on commas, semicolons, and colons
        chunks.forEach(chunk => {
            expect(chunk.text.trim().length).toBeGreaterThan(0);
        });
    });

    it("handles text without punctuation boundaries", () => {
        const text = "This is a very long sentence without any punctuation boundaries that should be split based on length constraints";
        const chunks = splitIntoClosedChunks(text, { minWindow: 20, maxWindow: 40 });

        expect(chunks.length).toBeGreaterThan(0);
        chunks.forEach(chunk => {
            expect(chunk.text.trim().length).toBeGreaterThan(0);
        });
    });

    it("maintains correct start and end indices", () => {
        const text = "First. Second. Third.";
        const chunks = splitIntoClosedChunks(text, { minWindow: 5, maxWindow: 15 });

        if (chunks.length > 0) {
            expect(chunks[0].start).toBe(0);
            expect(chunks[0].end).toBeGreaterThan(0);

            if (chunks.length > 1) {
                expect(chunks[1].start).toBeGreaterThan(chunks[0].end);
            }
        }
    });
});
