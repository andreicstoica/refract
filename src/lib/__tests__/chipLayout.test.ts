import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { groupProdsBySentence, calculateChipLayout } from "@/lib/chipLayout";
import { CHIP_LAYOUT } from "@/lib/layoutConstants";
import type { Prod } from "@/types/prod";
import type { SentencePosition } from "@/types/sentence";

const originalDocument = globalThis.document;

function restoreDocument() {
	if (originalDocument) {
		globalThis.document = originalDocument;
	} else {
		delete (globalThis as any).document;
	}
}

beforeEach(() => {
	(globalThis as any).document = {
		createElement: () => ({
			getContext: () => null,
		}),
	} as Document;
});

afterEach(() => {
	restoreDocument();
});

function makeProd(id: string, text: string, sentenceId: string, timestamp: number): Prod {
	return {
		id,
		text,
		sentenceId,
		sourceText: text,
		timestamp,
	};
}

const basePosition: SentencePosition = {
	sentenceId: "s1",
	top: 0,
	left: 0,
	width: 320,
	height: 24,
};

describe("groupProdsBySentence", () => {
	it("groups prods by their sentence id and preserves insertion order", () => {
		const prods = [
			makeProd("p1", "alpha", "s1", 1),
			makeProd("p2", "beta", "s2", 2),
			makeProd("p3", "gamma", "s1", 3),
		];

		const groups = groupProdsBySentence(prods);
		expect(groups.get("s1")?.map((prod) => prod.id)).toEqual(["p1", "p3"]);
		expect(groups.get("s2")?.map((prod) => prod.id)).toEqual(["p2"]);
	});
});

describe("calculateChipLayout", () => {
	it("centers chips vertically for mobile layouts", () => {
		const prods = [
			makeProd("p1", "a".repeat(15), "s1", 1),
			makeProd("p2", "b".repeat(8), "s1", 2),
		];

		const positions = new Map<string, SentencePosition>([["s1", basePosition]]);
		const layout = calculateChipLayout(prods, positions, 360);
		expect(layout.size).toBe(2);

		const first = layout.get("p1")!;
		expect(first.v).toBe(CHIP_LAYOUT.OFFSET_Y);
		expect(first.h).toBeCloseTo((360 - first.maxWidth) / 2, 5);

		const second = layout.get("p2")!;
		expect(second.v).toBe(CHIP_LAYOUT.OFFSET_Y + CHIP_LAYOUT.HEIGHT + 8);
		expect(second.h).toBeCloseTo((360 - second.maxWidth) / 2, 5);
	});

	it("reuses pinned placements on desktop when valid", () => {
		const prods = [
			makeProd("p1", "pinned content goes here", "s1", 1),
			makeProd("p2", "secondary chip", "s1", 2),
		];

		const positions = new Map<string, SentencePosition>([
			[
				"s1",
				{
					...basePosition,
					left: 50,
					width: 400,
				},
			],
		]);

		const previousPlacement = new Map<string, { h: number; v: number; maxWidth: number }>([
			["p1", { h: 40, v: 60, maxWidth: 160 }],
		]);

		const layout = calculateChipLayout(prods, positions, 800, new Set(["p1"]), previousPlacement);
		expect(layout.get("p1")?.h).toBeCloseTo(40, 3);
		expect(layout.get("p1")?.v).toBe(60);
		expect(layout.get("p2")).toBeDefined();
	});
});

