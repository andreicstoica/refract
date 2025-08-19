// Text styling constants that affect layout and positioning
export const TEXT_STYLES = {
    // Line height used in textarea - affects chip positioning
    LINE_HEIGHT: "", // Will use inline style for better v3 compatibility
    // Font size and other text properties
    FONT_SIZE: "text-lg",
    // Padding that affects positioning calculations
    PADDING: "px-4",
} as const;

// CSS classes that should be consistent across components
export const TEXTAREA_CLASSES = {
    BASE: "w-full bg-transparent outline-none border-none placeholder:text-muted-foreground/40 resize-none box-border",
    TEXT: `${TEXT_STYLES.FONT_SIZE} ${TEXT_STYLES.LINE_HEIGHT}`,
    PADDING: TEXT_STYLES.PADDING,
} as const;
