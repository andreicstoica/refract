export type HighlightRange = {
    start: number;
    end: number;
    color: string;
    themeId: string;
    intensity: number;
};

export type SegmentMeta = {
    start: number;
    end: number;
    color: string | null;
    intensity: number | null;
};
