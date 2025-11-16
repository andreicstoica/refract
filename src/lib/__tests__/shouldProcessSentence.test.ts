import { describe, it, expect } from "bun:test";
import { shouldProcessSentence } from "@/lib/shouldProcessSentence";
import type { Sentence } from "@/types/sentence";

function makeSentence(text: string): Sentence {
	return {
		id: `s-${text.length}`,
		text,
		startIndex: 0,
		endIndex: text.length,
	};
}

describe("shouldProcessSentence", () => {
	it("rejects short or punctuation-only sentences", () => {
		expect(shouldProcessSentence(makeSentence("too short"))).toBe(false);
		expect(shouldProcessSentence(makeSentence("!!!..."))).toBe(false);
	});

	it("rejects simple greetings and urls", () => {
		expect(shouldProcessSentence(makeSentence("Hello."))).toBe(false);
		expect(shouldProcessSentence(makeSentence("https://example.com"))).toBe(false);
	});

	it("rejects mostly whitespace sentences", () => {
		expect(shouldProcessSentence(makeSentence("   line \n "))).toBe(false);
	});

	it("approves descriptive content", () => {
		expect(shouldProcessSentence(makeSentence("This sentence contains enough detail to process."))).toBe(true);
	});
});

