import type { Sentence } from "./sentence";

export interface QueueItem {
    id: string;
    fullText: string;
    sentence: Sentence;
    timestamp: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface QueueState {
    items: QueueItem[];
    isProcessing: boolean;
}

export type QueueAction =
    | { type: 'ENQUEUE'; payload: Omit<QueueItem, 'status'> }
    | { type: 'START_PROCESSING'; payload: string }
    | { type: 'COMPLETE_PROCESSING'; payload: string }
    | { type: 'FAIL_PROCESSING'; payload: string }
    | { type: 'SET_PROCESSING'; payload: boolean }
    | { type: 'CLEAR_QUEUE' };
