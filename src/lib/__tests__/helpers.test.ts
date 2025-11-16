import { describe, it, expect, afterEach } from "bun:test";
import { cn, isMobileViewport, measureTextWidth } from "@/lib/helpers";

const originalDocument = globalThis.document;

function restoreDocument() {
	if (originalDocument) {
		globalThis.document = originalDocument;
	} else {
		delete (globalThis as any).document;
	}
}

afterEach(() => {
	restoreDocument();
});

describe("helpers", () => {
	describe("cn", () => {
		it("merges class names and removes duplicates", () => {
			const classes = cn("px-4", ["text-base", "px-4"], { hidden: false, block: true });
			expect(new Set(classes.split(" "))).toEqual(new Set(["px-4", "text-base", "block"]));
		});
	});

	describe("isMobileViewport", () => {
		it("uses default breakpoint when not provided", () => {
			expect(isMobileViewport(320)).toBe(true);
			expect(isMobileViewport(640)).toBe(false);
		});

		it("respects custom breakpoint", () => {
			expect(isMobileViewport(600, 768)).toBe(true);
			expect(isMobileViewport(900, 768)).toBe(false);
		});
	});

	describe("measureTextWidth", () => {
		it("falls back to character count when canvas is unavailable", () => {
			(globalThis as any).document = {
				createElement: () => ({ getContext: () => null }),
			};

			expect(measureTextWidth("fallback")).toBe("fallback".length * 8);
		});

		it("uses canvas measurement when available", () => {
			const context = {
				font: "",
				measureText: (value: string) => ({ width: value.length * 5 }),
			};

			(globalThis as any).document = {
				createElement: () => ({
					getContext: () => context,
				}),
			};

			const width = measureTextWidth("canvas", "16px sans-serif");
			expect(context.font).toBe("16px sans-serif");
			expect(width).toBe(30);
		});
	});
});
