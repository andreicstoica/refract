export interface Theme {
    id: string;
    label: string;
    description?: string;
    confidence: number;
    chunkCount: number;
    color?: string;
    chunks?: Array<{ text: string; sentenceId: string }>;
}
