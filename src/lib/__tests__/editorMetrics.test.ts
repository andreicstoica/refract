import { describe, it, expect } from "bun:test";
import { calculateEditorMetrics } from "@/lib/editorMetrics";

describe("editorMetrics", () => {
	it("detects empty content correctly", () => {
		const metrics = calculateEditorMetrics("");
		expect(metrics.hasContent).toBe(false);
		expect(metrics.lineCount).toBe(1);
		expect(metrics.shouldUseFullHeight).toBe(false);
	});

	it("counts lines and trims whitespace to determine content", () => {
		const metrics = calculateEditorMetrics("First line\n\nSecond line");
		expect(metrics.hasContent).toBe(true);
		expect(metrics.lineCount).toBe(3);
		expect(metrics.shouldUseFullHeight).toBe(false);
	});

	it("uses full height when text is long or multi-line", () => {
		const longText = "x".repeat(401);
		const longMetrics = calculateEditorMetrics(longText);
		expect(longMetrics.shouldUseFullHeight).toBe(true);

		const manyLines = Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n");
		const lineMetrics = calculateEditorMetrics(manyLines);
		expect(lineMetrics.shouldUseFullHeight).toBe(true);
	});
});
