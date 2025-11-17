import { describe, it, expect, afterEach } from "bun:test";
import { splitIntoSentences, measureSentencePositions, clearPositionCache } from "@/lib/sentences";
import type { Sentence } from "@/types/sentence";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

function restoreDom() {
	if (originalDocument) {
		globalThis.document = originalDocument;
	} else {
		delete (globalThis as any).document;
	}

	if (originalWindow) {
		globalThis.window = originalWindow;
	} else {
		delete (globalThis as any).window;
	}
}

function setupMeasurementDom(sentences: Sentence[]) {
	let lookupCount = 0;
	const spanRects = new Map<string, DOMRect>();
	const baseRects = [
		{ left: 50, top: 40, width: 90, height: 28 },
		{ left: 180, top: 80, width: 100, height: 28 },
	];

	sentences.forEach((sentence, index) => {
		const rect = baseRects[index] ?? baseRects[0];
		const domRect = {
			...rect,
			right: rect.left + rect.width,
			bottom: rect.top + rect.height,
		} as DOMRect;
		spanRects.set(`mirror-sent-${sentence.id}`, domRect);
	});

	const fakeMirror: any = {
		id: "",
		style: {},
		set innerHTML(_value: string) {},
	};

	(globalThis as any).document = {
		body: { appendChild: () => {} },
		createElement: () => ({ ...fakeMirror }),
		getElementById: (id: string) => {
			lookupCount += 1;
			const rect = spanRects.get(id);
			if (!rect) return null;
			return {
				getBoundingClientRect: () => rect,
			};
		},
	} as Document;

	(globalThis as any).window = {
		scrollX: 0,
		scrollY: 0,
		getComputedStyle: () => ({
			font: "16px Plex",
			padding: "12px 8px",
			width: "400px",
			lineHeight: "28px",
			overflowWrap: "anywhere",
			wordBreak: "break-word",
			boxSizing: "border-box",
			paddingTop: "12px",
			paddingLeft: "8px",
		}),
	};

	const textarea = {
		value: sentences.map((s) => s.text).join(" "),
		getBoundingClientRect: () => ({
			left: 10,
			top: 5,
			right: 310,
			bottom: 205,
			width: 300,
			height: 200,
		}),
	} as unknown as HTMLTextAreaElement;

	return {
		textarea,
		getLookupCount: () => lookupCount,
	};
}

afterEach(() => {
	clearPositionCache();
	restoreDom();
});

describe("splitIntoSentences", () => {
	it("splits text on punctuation while preserving indices", () => {
		const result = splitIntoSentences("  First idea. Second line? Third!");
		expect(result).toHaveLength(3);
		expect(result[0].text).toBe("First idea.");
		expect(result[0].startIndex).toBe(2);
		expect(result[1].startIndex).toBeGreaterThan(result[0].endIndex);
	});

	it("splits on newline boundaries when punctuation is missing", () => {
		const result = splitIntoSentences("First idea\nSecond line\r\nThird chunk");
		expect(result).toHaveLength(3);
		expect(result[0].text).toBe("First idea");
		expect(result[1].text).toBe("Second line");
		expect(result[2].text).toBe("Third chunk");
		expect(result[1].startIndex).toBeGreaterThan(result[0].endIndex);
	});

	it("returns the entire text when no terminal punctuation exists", () => {
		const result = splitIntoSentences("stream of consciousness");
		expect(result).toHaveLength(1);
		expect(result[0].text).toBe("stream of consciousness");
		expect(result[0].startIndex).toBe(0);
	});
});

describe("measureSentencePositions", () => {
	it("measures positions relative to the textarea and caches results", () => {
		const sentences: Sentence[] = [
			{ id: "s1", text: "First idea.", startIndex: 0, endIndex: 11 },
			{ id: "s2", text: "Second move.", startIndex: 12, endIndex: 24 },
		];

		const { textarea, getLookupCount } = setupMeasurementDom(sentences);
		const positions = measureSentencePositions(sentences, textarea);
		expect(positions).toHaveLength(2);
		expect(positions[0].left).toBeCloseTo(32, 3);
		expect(positions[0].top).toBeCloseTo(23, 3);
		expect(positions[0].height).toBeCloseTo(28, 3);

		const firstLookups = getLookupCount();
		const cached = measureSentencePositions(sentences, textarea);
		expect(cached).toBe(positions);
		expect(getLookupCount()).toBe(firstLookups);

		clearPositionCache();
		const recalculated = measureSentencePositions(sentences, textarea);
		expect(recalculated).not.toBe(positions);
		expect(recalculated[1].left).toBeGreaterThan(recalculated[0].left);
	});

	it("returns empty positions when textarea or sentences are missing", () => {
		expect(measureSentencePositions([], null as unknown as HTMLTextAreaElement)).toEqual([]);
	});
});
