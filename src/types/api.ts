import type { Sentence } from "./sentence";
import type { Theme } from "./theme";

export interface ProdRequest {
    lastParagraph: string;
    fullText: string;
}

export interface ProdResponse {
    shouldSkip?: boolean;
    selectedProd?: string;
    confidence?: number;
}

export interface EmbeddingsRequest {
    sentences: Sentence[];
    fullText: string;
}

export interface EmbeddingsResponse {
    clusters: any[];
    themes: Theme[];
    usage: {
        tokens: number;
        cost?: number;
    };
    debug?: {
        totalSentences: number;
        totalClusters: number;
        finalClusters: number;
    };
}
