import type { ClusterResult } from "@/types/embedding";
import type { ThemeData } from "./themeGenerator";
import { MIN_CHUNK_CORRELATION } from "@/lib/highlight";

export interface EnrichedCluster extends ClusterResult {
    description: string;
    color: string;
}

export interface ThemeForResponse {
    id: string;
    label: string;
    description: string;
    confidence: number;
    chunkCount: number;
    color: string;
    chunks: Array<{
        text: string;
        sentenceId: string;
        correlation: number;
    }>;
}

/**
 * Enrich clusters with AI-generated theme data
 */
export function enrichClustersWithThemes(
    clusters: ClusterResult[],
    themes: ThemeData[]
): EnrichedCluster[] {
    return clusters.map((cluster) => {
        const theme = themes.find(t => t.clusterId === cluster.id);
        return {
            ...cluster,
            label: theme?.label || cluster.label,
            description: theme?.description || "",
            confidence: Math.min(cluster.confidence, theme?.confidence || 0.5),
            color: theme?.color || "#3b82f6",
        };
    });
}

/**
 * Sort and limit clusters by relevance (confidence * size)
 */
export function selectTopClusters(
    clusters: EnrichedCluster[],
    limit: number = 3
): EnrichedCluster[] {
    return clusters
        .sort((a, b) => (b.confidence * b.chunks.length) - (a.confidence * a.chunks.length))
        .slice(0, limit);
}

/**
 * Format enriched clusters for API response
 */
export function formatClustersForResponse(clusters: EnrichedCluster[]): ThemeForResponse[] {
    return clusters.map(c => {
        const filtered = c.chunks.filter(ch =>
            typeof ch.correlation === "number" && ch.correlation >= MIN_CHUNK_CORRELATION
        );

        return {
            id: c.id,
            label: c.label,
            description: c.description,
            confidence: c.confidence,
            chunkCount: filtered.length,
            color: c.color,
            chunks: filtered.map(ch => ({
                text: ch.text,
                sentenceId: ch.sentenceId,
                correlation: ch.correlation as number,
            })),
        };
    });
}

