import { describe, it, expect, beforeEach } from "bun:test";
import { storage } from "@/services/storage";
import type { Theme } from "@/types/theme";

// Minimal localStorage mock
class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

describe("storage service", () => {
  beforeEach(() => {
    // @ts-expect-error - assign test mock
    globalThis.localStorage = new LocalStorageMock();
  });

  it("returns null and clears themes when correlation is missing (migration)", () => {
    const badThemes: Theme[] = [
      {
        id: "t1",
        label: "Theme",
        confidence: 0.5,
        chunkCount: 1,
        chunks: [
          // @ts-expect-error - missing correlation simulates old cache
          { sentenceId: "s1", text: "Hello" },
        ],
      },
    ];
    storage.setThemes(badThemes);
    const out = storage.getThemes();
    expect(out).toBeNull();
    // Ensure it cleared
    expect(globalThis.localStorage.getItem("refract-themes")).toBeNull();
  });

  it("persists and retrieves valid themes", () => {
    const good: Theme[] = [
      {
        id: "t2",
        label: "Good",
        confidence: 0.9,
        chunkCount: 1,
        chunks: [{ sentenceId: "s1", text: "Hi", correlation: 0.7 }],
      },
    ];
    storage.setThemes(good);
    const out = storage.getThemes();
    expect(out?.[0].id).toBe("t2");
    expect(out?.[0].chunks?.[0].correlation).toBeCloseTo(0.7, 5);
  });
});

