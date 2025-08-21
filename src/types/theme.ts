export interface Theme {
    id: string;
    label: string;
    description?: string;
    confidence: number;
    chunkCount: number;
    color?: string;
    // Per-chunk correlation (cosine similarity to assigned cluster centroid)
    chunks?: Array<{ text: string; sentenceId: string; correlation: number }>;
}
