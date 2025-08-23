import { describe, it, expect } from "bun:test";
import { computeChipLayout, estimateChipWidthPx } from "@/lib/chipLayout";
import type { SentencePosition } from "@/types/sentence";

function absLeft(pos: SentencePosition, h: number, leftPad: number) {
  return pos.left + leftPad + h;
}

describe("computeChipLayout", () => {
  const bounds = {
    containerWidth: 400,
    leftPad: 16,
    rightPad: 16,
    gapX: 8,
    rowGap: 20,
    maxRowsPerSentence: 3,
  } as const;

  const sA: SentencePosition = { sentenceId: "sa", top: 0, left: 0, width: 200, height: 56 };
  const sB: SentencePosition = { sentenceId: "sb", top: 0, left: 120, width: 200, height: 56 };
  const sC: SentencePosition = { sentenceId: "sc", top: 200, left: 300, width: 40, height: 56 }; // near right edge

  const posMap = new Map<string, SentencePosition>([
    [sA.sentenceId, sA],
    [sB.sentenceId, sB],
    [sC.sentenceId, sC],
  ]);

  it("keeps chips within left/right bounds and avoids overlap on the same row", () => {
    const prods = [
      { id: "p1", sentenceId: "sa", text: "alpha", timestamp: 1 },
      { id: "p2", sentenceId: "sa", text: "beta longer", timestamp: 2 },
      { id: "p3", sentenceId: "sa", text: "gamma", timestamp: 3 },
    ];
    const layout = computeChipLayout(prods, posMap, bounds);
    const rightLimit = bounds.containerWidth - bounds.rightPad;

    // No chip should exceed the right limit and offsets must be non-negative
    for (const p of prods) {
      const off = layout.get(p.id)!;
      const estW = estimateChipWidthPx(p.text);
      const left = absLeft(sA, off.h, bounds.leftPad);
      expect(left).toBeGreaterThanOrEqual(bounds.leftPad);
      expect(left + Math.min(estW, off.maxWidth ?? estW)).toBeLessThanOrEqual(rightLimit + 1);
      expect(off.v).toBeGreaterThanOrEqual(0);
    }

    // Ensure no pair overlaps on the same row
    const rects = prods.map((p) => {
      const off = layout.get(p.id)!;
      const w = estimateChipWidthPx(p.text);
      const left = absLeft(sA, off.h, bounds.leftPad);
      const top = sA.top + Math.min(44, sA.height) + 4 + off.v;
      return { id: p.id, left, right: left + w, top, bottom: top + 20 };
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlapX = a.left < b.right && a.right > b.left;
        const sameRow = a.top === b.top;
        expect(!(overlapX && sameRow)).toBe(true);
      }
    }
  });

  it("clamps chips near the right edge and uses next rows when needed", () => {
    const prods = [
      { id: "p4", sentenceId: "sc", text: "very very very long chip text here", timestamp: 1 },
      { id: "p5", sentenceId: "sc", text: "second", timestamp: 2 },
    ];
    const layout = computeChipLayout(prods, posMap, bounds);
    const rightLimit = bounds.containerWidth - bounds.rightPad;

    const off1 = layout.get("p4")!;
    const left1 = absLeft(sC, off1.h, bounds.leftPad);
    const estW1 = estimateChipWidthPx(prods[0].text);
    expect(left1).toBeGreaterThanOrEqual(bounds.leftPad);
    expect(left1 + Math.min(estW1, off1.maxWidth ?? estW1)).toBeLessThanOrEqual(rightLimit + 1);

    const off2 = layout.get("p5")!;
    // If not enough room on row 0, it should drop to row 1
    expect(off2.v === 0 || off2.v === bounds.rowGap).toBe(true);
  });

  it("avoids overlaps across sentences on the same visual line", () => {
    const prods = [
      { id: "pa", sentenceId: "sa", text: "alpha long", timestamp: 1 },
      { id: "pb", sentenceId: "sb", text: "beta long", timestamp: 2 },
    ];
    const layout = computeChipLayout(prods, posMap, bounds);

    const offA = layout.get("pa")!;
    const offB = layout.get("pb")!;
    const leftA = absLeft(sA, offA.h, bounds.leftPad);
    const leftB = absLeft(sB, offB.h, bounds.leftPad);
    const topA = sA.top + Math.min(44, sA.height) + 4 + offA.v;
    const topB = sB.top + Math.min(44, sB.height) + 4 + offB.v;

    const wA = estimateChipWidthPx("alpha long");
    const wB = estimateChipWidthPx("beta long");
    const overlapX = leftA < leftB + wB && leftA + wA > leftB;

    // If same row, they should not overlap; if overlapping would happen, one should be on the next row
    if (topA === topB) {
      expect(overlapX).toBe(false);
    } else {
      expect(topA === topB + bounds.rowGap || topB === topA + bounds.rowGap).toBe(true);
    }
  });
});

