export interface Sentence {
    id: string;
    text: string;
    startIndex: number;
    endIndex: number;
}

export interface SentencePosition {
    sentenceId: string;
    top: number;
    left: number;
    width: number;
    height: number;
}
