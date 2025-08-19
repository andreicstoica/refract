import type { Sentence } from "./sentence";

export interface TextChunk {
    id: string;
    text: string;
    sentenceId: string;
    embedding?: number[];
}

export interface EmbeddingResult {
    chunks: TextChunk[];
    embeddings: number[][];
    usage: {
        tokens: number;
        cost?: number;
    };
}

export interface ClusterResult {
    id: string;
    label: string;
    chunks: TextChunk[];
    centroid: number[];
    confidence: number;
    color?: string;
    description?: string;
}
