// Text styling constants that affect layout and positioning
export const TEXT_STYLES = {
	// Line height used in textarea - affects chip positioning
	LINE_HEIGHT: "", // Keep inline line-height to ensure exact measurement parity
	// Font size and other text properties (single source of truth)
	// Use text-base (1rem) to match measurement logic
	FONT_SIZE: "text-base",
	// Padding that affects positioning calculations
	PADDING: "px-4",
} as const;

// Shared text display styles used across write and themes pages
export const TEXT_DISPLAY_STYLES = {
	// Inline styles that must be consistent
	INLINE_STYLES: {
		lineHeight: "3.5rem",
		wordBreak: "break-word" as const,
		overflowWrap: "anywhere" as const,
	},
	// Base classes for text display (match textarea padding/flow)
	CLASSES: `whitespace-pre-wrap font-plex ${TEXT_STYLES.FONT_SIZE} w-full bg-transparent outline-none border-none box-border ${TEXT_STYLES.PADDING}`,
} as const;

// CSS classes that should be consistent across components
export const TEXTAREA_CLASSES = {
	BASE: "w-full bg-transparent outline-none border-none placeholder:text-muted-foreground/40 resize-none box-border",
	TEXT: `${TEXT_STYLES.FONT_SIZE} ${TEXT_STYLES.LINE_HEIGHT}`,
	PADDING: TEXT_STYLES.PADDING,
} as const;

// Chip positioning and layout constants
export const CHIP_LAYOUT = {
	// Breakpoints
	MOBILE_BREAKPOINT: 480, // Only very small screens get left-align treatment

	// Dimensions
	HEIGHT: 32,
	MIN_WIDTH: 100, // Smaller for mobile
	MAX_WIDTH: 280,
	SPACING: 8,
	BOUNDARY_PAD: 16,
	OFFSET_Y: 44,

	// Mobile adjustments
	MOBILE_MIN_WIDTH: 80,
	MOBILE_MAX_WIDTH: 200,
	MOBILE_SPACING: 4,
} as const;
