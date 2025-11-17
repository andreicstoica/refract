import { describe, it, expect, vi, beforeEach } from "bun:test";
import { generateEmbeddings } from "@/features/themes/services/embeddingsClient";
import type { EmbeddingsResponse } from "@/types/api";
import type { Sentence } from "@/types/sentence";

const fetchMock = vi.fn<typeof fetch>();

// Mock fetch globally, including Bun's preconnect helper
global.fetch = Object.assign(fetchMock, {
	preconnect: vi.fn(),
}) as typeof fetch;

function createJsonResponse(body: EmbeddingsResponse, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	return new Response(JSON.stringify(body), {
		...init,
		headers,
		status: init?.status ?? 200,
	});
}

function createInvalidJsonResponse() {
	const response = new Response(null, { status: 200 });
	response.json = async () => {
		throw new Error("Invalid JSON");
	};
	return response;
}

describe("embeddingsClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("generates embeddings successfully", async () => {
		const mockResponse = {
			clusters: [],
			themes: [
				{
					id: "theme-1",
					label: "Work Productivity",
					confidence: 0.85,
					chunkCount: 2,
				},
			],
			usage: { tokens: 0 },
		} satisfies EmbeddingsResponse;

		fetchMock.mockResolvedValueOnce(createJsonResponse(mockResponse));

        const sentences: Sentence[] = [
            { id: "sentence-1", text: "I had a productive day at work.", startIndex: 0, endIndex: 30 },
            { id: "sentence-2", text: "The meeting went really well.", startIndex: 31, endIndex: 55 },
        ];

        const result = await generateEmbeddings({
            sentences,
            fullText: "I had a productive day at work. The meeting went really well.",
        });

        expect(fetchMock).toHaveBeenCalledWith("/api/embeddings", {
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
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 500, statusText: "Internal Server Error" }));

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
        fetchMock.mockRejectedValueOnce(new Error("Network error"));

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
		const mockResponse = {
			clusters: [],
			themes: [],
			usage: { tokens: 0 },
		} satisfies EmbeddingsResponse;

		fetchMock.mockResolvedValueOnce(createJsonResponse(mockResponse));

        const result = await generateEmbeddings({
            sentences: [],
            fullText: "",
        });

		expect(result).toEqual(mockResponse);
		expect(fetchMock).toHaveBeenCalledWith("/api/embeddings", {
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
		fetchMock.mockResolvedValueOnce(createInvalidJsonResponse());

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
