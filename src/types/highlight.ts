export type HighlightRange = {
    start: number;
    end: number;
    color: string;
    themeId: string;
};

export type TextSegment = {
    start: number;
    end: number;
    color: string | null;
};

export type SegmentMeta = {
    start: number;
    end: number;
    color: string | null;
};
