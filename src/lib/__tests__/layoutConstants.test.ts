import { describe, it, expect } from "bun:test";
import { TEXT_STYLES, TEXT_DISPLAY_STYLES, TEXTAREA_CLASSES, CHIP_LAYOUT } from "@/lib/layoutConstants";

describe("layout constants", () => {
	it("keeps textarea padding and font styles consistent", () => {
		expect(TEXTAREA_CLASSES.PADDING).toBe(TEXT_STYLES.PADDING);
		expect(TEXTAREA_CLASSES.TEXT).toContain(TEXT_STYLES.FONT_SIZE);
		expect(TEXT_DISPLAY_STYLES.CLASSES).toContain(TEXT_STYLES.FONT_SIZE);
	});

	it("exposes immutable text display inline styles", () => {
		expect(TEXT_DISPLAY_STYLES.INLINE_STYLES.lineHeight).toBe("3.5rem");
		expect(TEXT_DISPLAY_STYLES.INLINE_STYLES.wordBreak).toBe("break-word");
	});

	it("defines chip layout defaults for both desktop and mobile", () => {
		expect(CHIP_LAYOUT.MIN_WIDTH).toBeLessThan(CHIP_LAYOUT.MAX_WIDTH);
		expect(CHIP_LAYOUT.MOBILE_MIN_WIDTH).toBeLessThan(CHIP_LAYOUT.MOBILE_MAX_WIDTH);
		expect(CHIP_LAYOUT.BOUNDARY_PAD).toBeGreaterThan(0);
		expect(typeof CHIP_LAYOUT.OFFSET_Y).toBe("number");
	});
});

