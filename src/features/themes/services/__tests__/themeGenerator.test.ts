import { describe, it, expect, vi, beforeEach, mock } from "bun:test";
import { generateThemesForClusters } from "../themeGenerator";
import type { ClusterResult } from "@/types/embedding";

const generateObjectMock = vi.fn();
const openaiMock = vi.fn();

mock.module("ai", () => ({
    generateObject: generateObjectMock,
}));

mock.module("@ai-sdk/openai", () => ({
    openai: openaiMock,
}));

mock.module("@/lib/debug", () => ({
    debug: {
        dev: vi.fn(),
        error: vi.fn(),
    },
}));

describe("themeGenerator", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateObjectMock.mockClear();
    });

    const createMockCluster = (id: string, chunks: Array<{ text: string }> = []): ClusterResult => ({
        id,
        label: `Cluster ${id}`,
        chunks: chunks.map((chunk, idx) => ({
            id: `chunk-${id}-${idx}`,
            text: chunk.text,
            sentenceId: `sentence-${idx}`,
        })),
        centroid: [0.5, 0.5],
        confidence: 0.8,
    });

    it("returns empty array for empty clusters", async () => {
        const result = await generateThemesForClusters([]);
        expect(result).toEqual([]);
        expect(generateObjectMock).not.toHaveBeenCalled();
    });

    it("resolves themes with valid suggested cluster IDs", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Creative Flow",
                        description: "Creative thoughts",
                        confidence: 0.9,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "cluster-2",
                        theme: "Work Focus",
                        description: "Work-related thoughts",
                        confidence: 0.85,
                        color: "#3B82F6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Creative Flow",
            description: "Creative thoughts",
            confidence: 0.9,
            color: "#8B5CF6",
        });
        expect(result[1]).toMatchObject({
            clusterId: "cluster-2",
            label: "Work Focus",
            description: "Work-related thoughts",
            confidence: 0.85,
            color: "#3B82F6",
        });
    });

    it("falls back to index-based cluster IDs when suggested IDs are invalid", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "invalid-cluster-id",
                        theme: "Theme 1",
                        description: "First theme",
                        confidence: 0.8,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "another-invalid-id",
                        theme: "Theme 2",
                        description: "Second theme",
                        confidence: 0.8,
                        color: "#3B82F6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Theme 1",
        });
        expect(result[1]).toMatchObject({
            clusterId: "cluster-2",
            label: "Theme 2",
        });
    });

    it("uses fallback cluster ID when suggested ID is missing and index is out of bounds", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "invalid-id",
                        theme: "Theme 1",
                        description: "First theme",
                        confidence: 0.8,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "also-invalid",
                        theme: "Theme 2",
                        description: "Second theme",
                        confidence: 0.8,
                        color: "#3B82F6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        // Second theme resolves to "cluster-1" (fallback cluster-${index} where index=1)
        // which already exists, so it gets skipped
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Theme 1",
        });
    });

    it("skips duplicate resolved cluster IDs", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Theme 1",
                        description: "First theme",
                        confidence: 0.8,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "cluster-1",
                        theme: "Duplicate Theme",
                        description: "Should be skipped",
                        confidence: 0.8,
                        color: "#3B82F6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        // When both themes suggest "cluster-1", the first resolves to "cluster-1"
        // The second also resolves to "cluster-1" but gets skipped due to duplicate check
        // However, cluster-2 is missing, so a fallback theme is generated for it
        expect(result).toHaveLength(2);

        const cluster1Theme = result.find(r => r.clusterId === "cluster-1");
        expect(cluster1Theme).toBeDefined();
        expect(cluster1Theme?.label).toBe("Theme 1");

        // cluster-2 gets a fallback theme since it wasn't covered by AI themes
        const cluster2Theme = result.find(r => r.clusterId === "cluster-2");
        expect(cluster2Theme).toBeDefined();
        expect(cluster2Theme?.label).toBe("Theme 1"); // Fallback theme (index 0 in missingClusters array)
    });

    it("generates fallback themes for missing clusters", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
            createMockCluster("cluster-3", [{ text: "Third thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Theme 1",
                        description: "First theme",
                        confidence: 0.8,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "cluster-2",
                        theme: "Theme 2",
                        description: "Second theme",
                        confidence: 0.8,
                        color: "#3B82F6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Theme 1",
        });
        expect(result[1]).toMatchObject({
            clusterId: "cluster-2",
            label: "Theme 2",
        });
        expect(result[2]).toMatchObject({
            clusterId: "cluster-3",
            label: "Theme 1",
            description: "A collection of related thoughts and experiences",
            confidence: 0.5,
        });
        expect(result[2].color).toBeDefined();
    });

    it("provides default description and confidence when missing", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Creative Flow",
                        description: undefined,
                        confidence: undefined,
                        color: "#8B5CF6",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Creative Flow",
            description: "Theme representing creative flow",
            confidence: 0.8,
            color: "#8B5CF6",
        });
    });

    it("returns fallback themes when AI generation fails", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
        ];

        generateObjectMock.mockRejectedValueOnce(new Error("AI API error"));

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Theme 1",
            description: "A collection of related thoughts and experiences",
            confidence: 0.5,
        });
        expect(result[1]).toMatchObject({
            clusterId: "cluster-2",
            label: "Theme 2",
            description: "A collection of related thoughts and experiences",
            confidence: 0.5,
        });
        expect(result[0].color).toBeDefined();
        expect(result[1].color).toBeDefined();
    });

    it("handles mixed valid and invalid cluster IDs", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
            createMockCluster("cluster-2", [{ text: "Second thought" }]),
            createMockCluster("cluster-3", [{ text: "Third thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Valid Theme",
                        description: "Valid theme",
                        confidence: 0.9,
                        color: "#8B5CF6",
                    },
                    {
                        clusterId: "invalid-id",
                        theme: "Fallback Theme",
                        description: "Should use cluster-2",
                        confidence: 0.8,
                        color: "#3B82F6",
                    },
                    {
                        clusterId: "cluster-3",
                        theme: "Another Valid",
                        description: "Another valid theme",
                        confidence: 0.85,
                        color: "#10B981",
                    },
                ],
            },
        } as any);

        const result = await generateThemesForClusters(clusters);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
            clusterId: "cluster-1",
            label: "Valid Theme",
        });
        expect(result[1]).toMatchObject({
            clusterId: "cluster-2",
            label: "Fallback Theme",
        });
        expect(result[2]).toMatchObject({
            clusterId: "cluster-3",
            label: "Another Valid",
        });
    });

    it("includes fullText in prompt when provided", async () => {
        const clusters = [
            createMockCluster("cluster-1", [{ text: "First thought" }]),
        ];

        generateObjectMock.mockResolvedValueOnce({
            object: {
                themes: [
                    {
                        clusterId: "cluster-1",
                        theme: "Theme",
                        description: "Description",
                        confidence: 0.8,
                        color: "#8B5CF6",
                    },
                ],
            },
        } as any);

        await generateThemesForClusters(clusters, "Full text context");

        expect(generateObjectMock).toHaveBeenCalled();
        const callArgs = generateObjectMock.mock.calls[0][0];
        expect(callArgs.prompt).toContain("Full text context");
    });
});

