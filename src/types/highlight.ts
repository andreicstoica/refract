export type HighlightRange = {
    start: number;
    end: number;
    color: string;
    themeId: string;
    intensity: number;
};

export type SegmentPaintState = {
    start: number;
    end: number;
    color: string | null;
    intensity: number | null;
    themeId: string | null;
};
