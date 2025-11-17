import { describe, it, expect } from "bun:test";
import { splitIntoSentences } from "@/lib/sentences";

describe("splitIntoSentences", () => {
	it("returns empty array for empty or whitespace-only input", () => {
		expect(splitIntoSentences("")).toEqual([]);
		expect(splitIntoSentences("   \n\t  ")).toEqual([]);
	});

	it("splits a simple paragraph into sentences with indices", () => {
		const text = "Hello world. This is a test!";
		const sentences = splitIntoSentences(text);

		expect(Array.isArray(sentences)).toBe(true);
		expect(sentences.length).toBe(2);

		// Validate sentence texts (ids are time-based, so don't assert them)
		expect(sentences[0].text).toBe("Hello world.");
		expect(sentences[1].text).toBe("This is a test!");

		// Validate indices line up with the source string
		const s0Start = text.indexOf(sentences[0].text);
		const s0End = s0Start + sentences[0].text.length;
		expect(sentences[0].startIndex).toBe(s0Start);
		expect(sentences[0].endIndex).toBe(s0End);

		const s1Start = text.indexOf(sentences[1].text, s0End);
		const s1End = s1Start + sentences[1].text.length;
		expect(sentences[1].startIndex).toBe(s1Start);
		expect(sentences[1].endIndex).toBe(s1End);
	});

	it("handles repeated sentences with correct ordering and indices", () => {
		const text = "Hello. Hello. Hello.";
		const sentences = splitIntoSentences(text);

		expect(sentences.length).toBe(3);
		// Ensure IDs are stable and ordered - new format includes start index and content hash
		expect(sentences.map((s) => s.id)).toEqual([
			"sentence-0-hello",
			"sentence-7-hello",
			"sentence-14-hello"
		]);

		let cursor = 0;
		for (const s of sentences) {
			const start = text.indexOf(s.text, cursor);
			expect(s.startIndex).toBe(start);
			expect(s.endIndex).toBe(start + s.text.length);
			cursor = s.endIndex;
		}
	});

	it("handles newlines and maintains correct indices", () => {
		const text = "First line.\nSecond line continues here.\nThird line.";
		const sentences = splitIntoSentences(text);

		expect(sentences.length).toBe(3);
		let cursor = 0;
		for (const s of sentences) {
			const start = text.indexOf(s.text, cursor);
			expect(s.startIndex).toBe(start);
			expect(s.endIndex).toBe(start + s.text.length);
			cursor = s.endIndex;
		}
	});

	it("treats text without terminal punctuation as a single sentence", () => {
		const text = "This is a single sentence without punctuation";
		const sentences = splitIntoSentences(text);
		expect(sentences.length).toBe(1);
		expect(sentences[0].text).toBe(text);
		expect(sentences[0].startIndex).toBe(0);
		expect(sentences[0].endIndex).toBe(text.length);
	});

	it("supports unicode and emoji characters", () => {
		const text = "I love pizza 🍕.";
		const sentences = splitIntoSentences(text);
		expect(sentences.length).toBe(1);
		expect(sentences[0].text).toBe(text);
		expect(sentences[0].startIndex).toBe(0);
		expect(sentences[0].endIndex).toBe(text.length);
	});

	it("treats newline-only breaks as sentence boundaries", () => {
		const text = "Line one\nLine two\r\nLine three";
		const sentences = splitIntoSentences(text);

		expect(sentences.map((s) => s.text)).toEqual([
			"Line one",
			"Line two",
			"Line three",
		]);

		expect(sentences[1].startIndex).toBeGreaterThan(sentences[0].endIndex);
		expect(sentences[2].startIndex).toBeGreaterThan(sentences[1].endIndex);
	});
});
