import { describe, it, expect } from "vitest";
import { splitIntoSentences } from "@/lib/sentences";

function firstSentence(text: string) {
	const sentences = splitIntoSentences(text);
	if (sentences.length === 0) {
		throw new Error("No sentences produced for test input");
	}
	return sentences[0];
}

describe("Sentence ID stability", () => {
	it("generates stable IDs for growing sentences without punctuation", () => {
		const short = firstSentence("Hello world");
		const long = firstSentence("Hello world keeps growing without punctuation");
		// IDs should be the same because startIndex and content hash (first 20 chars) match
		expect(short.id).toBe(long.id);
		expect(short.startIndex).toBe(long.startIndex);
	});

	it("generates different IDs for sentences at different positions", () => {
		const sentences = splitIntoSentences("First. Second. Third.");
		expect(sentences[0].id).not.toBe(sentences[1].id);
		expect(sentences[1].id).not.toBe(sentences[2].id);
	});

	it("generates different IDs for sentences with different content", () => {
		const hello = firstSentence("Hello world");
		const goodbye = firstSentence("Goodbye world");
		expect(hello.id).not.toBe(goodbye.id);
	});
});
