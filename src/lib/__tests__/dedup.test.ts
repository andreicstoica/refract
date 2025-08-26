import { describe, it, expect } from "bun:test";
import { normalizeText, makeFingerprint, hasRecent, markNow, cleanupOlderThan } from "@/lib/dedup";

describe("dedup helpers", () => {
	it("normalizeText trims and lowercases", () => {
		expect(normalizeText("  Hello World  ")).toBe("hello world");
		expect(normalizeText("MIXED\nCase\t ")).toBe("mixed\ncase");
	});

	it("makeFingerprint uses 30-char prefix and length", () => {
		const short = "Hello";
		expect(makeFingerprint(short)).toBe("hello-5");

		const long = "a".repeat(50);
		// Expect 30 'a' + '-' + 50
		expect(makeFingerprint(long)).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-50");

		const mixed = "The quick brown fox jumps over the lazy dog"; // len 43
		// first 30 chars lowercased
		expect(makeFingerprint(mixed)).toBe("the quick brown fox jumps over-43");
	});

	it("hasRecent/markNow return true within TTL and false after", () => {
		const map = new Map<string, number>();
		const base = 1_000_000;
		const key = "k";
		const ttl = 500;

		expect(hasRecent(map, key, ttl, base)).toBe(false);
		markNow(map, key, base);
		expect(hasRecent(map, key, ttl, base)).toBe(true);
		// After ttl - 1
		expect(hasRecent(map, key, ttl, base + ttl - 1)).toBe(true);
		// After ttl
		expect(hasRecent(map, key, ttl, base + ttl)).toBe(false);
	});

	it("cleanupOlderThan prunes stale entries", () => {
		const map = new Map<string, number>([
			["a", 1000],
			["b", 2000],
			["c", 3000],
		]);

		cleanupOlderThan(map, 500, 3200); // keep >= 2700
		expect(map.has("a")).toBe(false);
		expect(map.has("b")).toBe(false);
		expect(map.has("c")).toBe(true);
	});
});
