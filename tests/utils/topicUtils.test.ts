import { describe, it, expect } from "bun:test";
import { jaccardOverlap, updateTopicState, DEFAULTS } from "@/lib/topic";

describe("topic utils", () => {
  it("computes jaccard overlap correctly", () => {
    expect(jaccardOverlap([], [])).toBe(1);
    expect(jaccardOverlap(["a"], [])).toBe(0);
    expect(jaccardOverlap(["a", "b"], ["b", "c"]).toFixed(2)).toBe("0.33");
    expect(jaccardOverlap(["x", "y"], ["x", "y"]).toFixed(2)).toBe("1.00");
  });

  it("signals topic shift after consecutive low overlaps", () => {
    const base = { keywords: ["work", "project"], emaOverlap: 0.5, lowCount: 0, lastUpdate: 0 };
    const cfg = { ...DEFAULTS, threshold: 0.4, minConsecutive: 2, alpha: 0.5 };

    // First low overlap → no shift yet, increments lowCount
    let r1 = updateTopicState(["garden", "sunny"], base, 1, cfg);
    expect(r1.shift).toBe(false);
    expect(r1.state.lowCount).toBeGreaterThan(0);

    // Second low overlap in a row → shift
    let r2 = updateTopicState(["garden", "flowers"], r1.state, 2, cfg);
    expect(r2.shift).toBe(true);
    expect(r2.state.keywords).toEqual(["garden", "flowers"]);
    expect(r2.state.lowCount).toBe(0); // reset on shift
    expect(r2.state.emaOverlap).toBeCloseTo(0.5, 3); // reset to neutral
  });

  it("preserves keyword array reference when set is identical and no shift", () => {
    const base = { keywords: ["a", "b", "c"], emaOverlap: 0.6, lowCount: 0, lastUpdate: 0 };
    const r = updateTopicState(["c", "b", "a"], base, 3, DEFAULTS);
    // No shift, same set → reference should be preserved
    expect(r.shift).toBe(false);
    expect(r.state.keywords).toBe(base.keywords);
  });
});

