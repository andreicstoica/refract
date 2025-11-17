import { describe, it, expect } from "vitest";
import { splitIntoSentences } from "@/lib/sentences";
import { resolveLatestSentence } from "@/features/prods/hooks/useProdQueueManager";

function firstSentence(text: string) {
	const sentences = splitIntoSentences(text);
	if (sentences.length === 0) {
		throw new Error("No sentences produced for test input");
	}
	return sentences[0];
}

describe("resolveLatestSentence", () => {
	it("returns the updated sentence when length changes but start index is stable", () => {
		const original = firstSentence("Hello world");
		const updated = resolveLatestSentence("Hello world keeps growing without punctuation", original);
		expect(updated.text).toBe("Hello world keeps growing without punctuation");
		expect(updated.id).not.toBe(original.id);
		expect(updated.startIndex).toBe(original.startIndex);
	});

	it("matches by normalized text when the start index shifts", () => {
		const fallback = firstSentence("  Leading space sentence stays same");
		const shiftedText = "Intro paragraphs. Leading space sentence stays same";
		const result = resolveLatestSentence(shiftedText, fallback);
		expect(result.text.trim()).toBe("Leading space sentence stays same");
		expect(result.startIndex).toBeGreaterThan(fallback.startIndex);
	});

	it("falls back to the last sentence when no match exists", () => {
		const sentences = splitIntoSentences("Intro stays. Second one changes.");
		const fallback = sentences[1];
		const unrelated = "Different text altogether. Brand new ending.";
		const result = resolveLatestSentence(unrelated, fallback);
		const latest = splitIntoSentences(unrelated);
		expect(result).toEqual(latest[latest.length - 1]);
	});
});
