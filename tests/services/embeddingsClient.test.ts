import { describe, it, expect, vi, beforeEach } from "bun:test";
import { generateEmbeddings } from "@/services/embeddingsClient";
import type { Sentence } from "@/types/sentence";

// Mock fetch globally
global.fetch = vi.fn();

describe("embeddingsClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("generates embeddings successfully", async () => {
        const mockResponse = {
            themes: [
                {
                    id: "theme-1",
                    label: "Work Productivity",
                    confidence: 0.85,
                    keywords: ["work", "productivity", "focus"],
                    sentenceIds: ["sentence-1", "sentence-2"],
                },
            ],
        };

        (fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const sentences: Sentence[] = [
            { id: "sentence-1", text: "I had a productive day at work.", startIndex: 0, endIndex: 30 },
            { id: "sentence-2", text: "The meeting went really well.", startIndex: 31, endIndex: 55 },
        ];

        const result = await generateEmbeddings({
            sentences,
            fullText: "I had a productive day at work. The meeting went really well.",
        });

        expect(fetch).toHaveBeenCalledWith("/api/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sentences,
                fullText: "I had a productive day at work. The meeting went really well.",
            }),
        });

        expect(result).toEqual(mockResponse);
    });

    it("handles API errors gracefully", async () => {
        (fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        const sentences: Sentence[] = [
            { id: "sentence-1", text: "Test sentence.", startIndex: 0, endIndex: 14 },
        ];

        await expect(
            generateEmbeddings({
                sentences,
                fullText: "Test sentence.",
            })
        ).rejects.toThrow("Embeddings API call failed: 500 Internal Server Error");
    });

    it("handles network errors", async () => {
        (fetch as any).mockRejectedValueOnce(new Error("Network error"));

        const sentences: Sentence[] = [
            { id: "sentence-1", text: "Test sentence.", startIndex: 0, endIndex: 14 },
        ];

        await expect(
            generateEmbeddings({
                sentences,
                fullText: "Test sentence.",
            })
        ).rejects.toThrow("Network error");
    });

    it("handles empty sentences array", async () => {
        const mockResponse = { themes: [] };

        (fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await generateEmbeddings({
            sentences: [],
            fullText: "",
        });

        expect(result).toEqual(mockResponse);
        expect(fetch).toHaveBeenCalledWith("/api/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sentences: [],
                fullText: "",
            }),
        });
    });

    it("handles malformed JSON response", async () => {
        (fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => {
                throw new Error("Invalid JSON");
            },
        });

        const sentences: Sentence[] = [
            { id: "sentence-1", text: "Test sentence.", startIndex: 0, endIndex: 14 },
        ];

        await expect(
            generateEmbeddings({
                sentences,
                fullText: "Test sentence.",
            })
        ).rejects.toThrow("Invalid JSON");
    });
});
