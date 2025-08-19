export interface Theme {
    id: string;
    label: string;
    description?: string;
    confidence: number;
    chunkCount: number;
    color?: string;
    intensity?: number;
    chunks?: Array<{ text: string; sentenceId: string }>;
}
