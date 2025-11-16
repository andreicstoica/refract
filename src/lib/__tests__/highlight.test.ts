import { describe, it, expect } from "bun:test";
import {
	STAGGER_PER_CHUNK,
	MIN_CHUNK_CORRELATION,
	rangesFromThemes,
	buildCutPoints,
	createSegments,
	computeSegmentPaintState,
	assignChunkIndices,
} from "@/lib/highlight";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";

const sentenceMap = new Map<string, Sentence>([
	["s1", { id: "s1", text: "First.", startIndex: 0, endIndex: 6 }],
	["s2", { id: "s2", text: "Second.", startIndex: 6, endIndex: 13 }],
]);

const themeList: Theme[] = [
	{
		id: "theme-1",
		label: "Momentum",
		confidence: 0.8,
		chunkCount: 2,
		color: "#abc",
		chunks: [
			{ text: "First.", sentenceId: "s1", correlation: 0.1 },
			{ text: "Second.", sentenceId: "s2", correlation: 0.15 },
		],
	},
];

describe("highlight helpers", () => {
	it("exposes baseline constants", () => {
		expect(STAGGER_PER_CHUNK).toBeGreaterThan(0);
		expect(MIN_CHUNK_CORRELATION).toBeGreaterThan(0);
	});

	it("builds ranges with stretched intensities and filtering", () => {
		const ranges = rangesFromThemes(themeList, sentenceMap, new Set(["theme-1"]));
		expect(ranges).toHaveLength(2);
		expect(ranges[0].start).toBe(0);
		expect(ranges[0].intensity).toBeCloseTo(0.3, 3);
		expect(ranges[1].intensity).toBeCloseTo(0.9, 3);

		const filtered = rangesFromThemes(themeList, sentenceMap, new Set(["missing"]));
		expect(filtered).toHaveLength(0);
	});

	it("builds cut points and segments from highlight ranges", () => {
		const ranges = rangesFromThemes(themeList, sentenceMap);
		const text = "First.Second.";
		const cuts = buildCutPoints(text, ranges);
		expect(cuts[0]).toBe(0);
		expect(cuts[cuts.length - 1]).toBe(text.length);

		const segments = createSegments(cuts);
		expect(segments.length).toBe(cuts.length - 1);
		expect(segments[0]).toEqual({ start: 0, end: cuts[1] });
	});

	it("computes paint state and chunk indices", () => {
		const ranges = rangesFromThemes(themeList, sentenceMap);
		const cuts = [0, 6, 13];
		const segments = createSegments(cuts);
		const paint = computeSegmentPaintState(segments, ranges);
		expect(paint[0].color).toBe("#abc");
		expect(paint[1].themeId).toBe("theme-1");

		const indices = assignChunkIndices(paint);
		expect(indices).toEqual([0, 0]);
	});
});
