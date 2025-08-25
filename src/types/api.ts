import type { Sentence } from "./sentence";
import type { Theme } from "./theme";
import type { ClusterResult } from "./embedding";

export interface ProdRequest {
    lastParagraph: string;
    fullText: string;
    recentProds?: string[];
    topicKeywords?: string[];
}

export interface ProdResponse {
    selectedProd?: string;
    confidence?: number;
}

export interface EmbeddingsRequest {
    sentences: Sentence[];
    fullText: string;
}

export interface EmbeddingsResponse {
    clusters: ClusterResult[];
    themes: Theme[];
    usage: {
        tokens: number;
        cost?: number;
    };

}
