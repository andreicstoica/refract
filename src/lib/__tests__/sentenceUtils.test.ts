import { describe, it, expect } from "vitest";
import { splitIntoSentences } from "@/lib/sentenceUtils";

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
});

