import { generateProd } from "@/services/prodClient";

// Mock fetch globally
global.fetch = jest.fn();

describe("prodClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return prod data on successful response", async () => {
    const mockBody = { selectedProd: "What felt most meaningful?", confidence: 0.9 };
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockBody),
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const result = await generateProd({
      lastParagraph: "I had a great day today",
      fullText: "I had a great day today. It was wonderful.",
    });

    expect(result.selectedProd).toBe("What felt most meaningful?");
    expect(result.confidence).toBe(0.9);
    expect(global.fetch).toHaveBeenCalledWith("/api/prod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastParagraph: "I had a great day today",
        fullText: "I had a great day today. It was wonderful.",
      }),
      signal: undefined,
    });
  });

  it("should handle API errors", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    await expect(
      generateProd({
        lastParagraph: "I had a great day today",
        fullText: "I had a great day today. It was wonderful.",
      })
    ).rejects.toThrow("Prod API call failed: 500 Internal Server Error");
  });

  it("should handle network errors", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    await expect(
      generateProd({
        lastParagraph: "I had a great day today",
        fullText: "I had a great day today. It was wonderful.",
      })
    ).rejects.toThrow("Network error");
  });
});

