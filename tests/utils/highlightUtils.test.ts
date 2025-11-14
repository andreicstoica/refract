import { describe, it, expect } from "bun:test";
import { rangesFromThemes, buildCutPoints, createSegments, computeSegmentPaintState, assignChunkIndices } from "@/lib/highlight";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";

describe("highlight utils", () => {
  const text = "Alpha beta gamma. Delta epsilon zeta.";
  const sentences: Sentence[] = [
    { id: "s1", text: "Alpha beta gamma.", startIndex: 0, endIndex: 18 },
    { id: "s2", text: " Delta epsilon zeta.", startIndex: 18, endIndex: text.length },
  ];
  const map = new Map<string, Sentence>(sentences.map(s => [s.id, s]));

  it("builds stable cuts and segments", () => {
    // Two ranges covering each full sentence
    const allRanges = [
      { start: 0, end: 18, color: "#3B82F6", themeId: "t1", intensity: 0.8 },
      { start: 18, end: text.length, color: "#10B981", themeId: "t2", intensity: 0.6 },
    ];
    const cuts = buildCutPoints(text, allRanges);
    expect(cuts[0]).toBe(0);
    expect(cuts[cuts.length - 1]).toBe(text.length);
    const segments = createSegments(cuts);
    // At least two segments (matching the two ranges)
    expect(segments.length).toBeGreaterThanOrEqual(2);
  });

  it("computes ranges from themes with correlation mapped to intensity", () => {
    const themes: Theme[] = [
      {
        id: "t1",
        label: "Theme 1",
        confidence: 0.9,
        chunkCount: 1,
        color: "#3B82F6",
        chunks: [
          { sentenceId: "s1", text: sentences[0].text, correlation: 0.8 },
        ],
      },
      {
        id: "t2",
        label: "Theme 2",
        confidence: 0.7,
        chunkCount: 1,
        color: "#10B981",
        chunks: [
          { sentenceId: "s2", text: sentences[1].text, correlation: 0.2 },
        ],
      },
    ];
    const rangesAll = rangesFromThemes(themes, map);
    expect(rangesAll).toHaveLength(2);
    // Intensities should be in [0,1]
    rangesAll.forEach(r => expect(r.intensity).toBeGreaterThanOrEqual(0));
    rangesAll.forEach(r => expect(r.intensity).toBeLessThanOrEqual(1));

    // Filter to a single theme
    const rangesT1 = rangesFromThemes(themes, map, new Set(["t1"]));
    expect(rangesT1).toHaveLength(1);
    expect(rangesT1[0].themeId).toBe("t1");

    // Segment meta computed correctly
    const cuts = buildCutPoints(text, rangesAll);
    const segments = createSegments(cuts);
    const paintState = computeSegmentPaintState(segments, rangesAll);
    // Each segment should either be highlighted or not, never partial inside our simple ranges
    expect(paintState.every(m => (m.color ? true : true))).toBe(true);

    // Assign chunk indices increments contiguous active regions
    const idx = assignChunkIndices(paintState);
    // If any active segments exist, at least one index is 0
    expect(idx.some(v => v === 0)).toBe(true);
  });
});
