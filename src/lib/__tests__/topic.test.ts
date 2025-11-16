import { describe, it, expect } from "bun:test";
import { extractKeywords, jaccardOverlap, updateTopicState, DEFAULTS, type TopicState } from "@/lib/topic";

type ParserConfig = {
	input: string;
	nouns: string[];
	verbs: string[];
	adjectives: string[];
	lemmas: Record<string, { noun?: string; verb?: string; adjective?: string }>;
};

class FakeCollection {
	constructor(private readonly values: string[]) {}

	out(format: string) {
		if (format === "array") {
			return [...this.values];
		}
		return this.values[0] ?? "";
	}

	toSingular() {
		return new FakeCollection(this.values);
	}

	toInfinitive() {
		return new FakeCollection(this.values);
	}

	toSuperlative() {
		return new FakeCollection(this.values);
	}
}

class FakeDoc {
	constructor(private readonly text: string, private readonly config: ParserConfig) {}

	private lemma(field: "noun" | "verb" | "adjective") {
		const key = this.text.toLowerCase();
		return this.config.lemmas[key]?.[field] ?? this.text;
	}

	nouns() {
		const values = this.text === this.config.input ? this.config.nouns : [this.lemma("noun")];
		return new FakeCollection(values.map((value) => value.toLowerCase()));
	}

	verbs() {
		const values = this.text === this.config.input ? this.config.verbs : [this.lemma("verb")];
		return new FakeCollection(values.map((value) => value.toLowerCase()));
	}

	adjectives() {
		const values = this.text === this.config.input ? this.config.adjectives : [this.lemma("adjective")];
		return new FakeCollection(values.map((value) => value.toLowerCase()));
	}
}

function createFakeParser(config: ParserConfig) {
	return (text: string) => new FakeDoc(text, config);
}

describe("topic utilities", () => {
	it("extracts normalized keywords with injected parser", () => {
		const parser = createFakeParser({
			input: "Projects build brighter days.",
			nouns: ["Projects", "days"],
			verbs: ["builds"],
			adjectives: ["brighter"],
			lemmas: {
				projects: { noun: "project" },
				days: { noun: "day" },
				builds: { verb: "build" },
				brighter: { verb: "bright", adjective: "bright" },
			},
		});

		const keywords = extractKeywords("Projects build brighter days.", parser);
		expect(keywords).toEqual(["project", "day", "build", "bright"]);
	});

	it("computes Jaccard overlap between keyword sets", () => {
		expect(jaccardOverlap(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3, 5);
		expect(jaccardOverlap([], [])).toBe(1);
		expect(jaccardOverlap(["a"], [])).toBe(0);
	});

	it("updates topic state and detects shifts", () => {
		const baseState: TopicState = {
			keywords: ["focus"],
			emaOverlap: 0.5,
			lowCount: 0,
			lastUpdate: 0,
		};

		const unchanged = updateTopicState(["focus"], baseState, 1000, { ...DEFAULTS, alpha: 0.5 });
		expect(unchanged.shift).toBe(false);
		expect(unchanged.state.keywords).toEqual(["focus"]);
		expect(unchanged.state.lowCount).toBe(0);
		expect(unchanged.state.lastUpdate).toBe(1000);

		const shifted = updateTopicState(
			["travel"],
			{ ...baseState, lowCount: DEFAULTS.minConsecutive - 1, emaOverlap: 0.1 },
			1000,
			{ ...DEFAULTS, minConsecutive: 1, threshold: 0.4 }
		);
		expect(shifted.shift).toBe(true);
		expect(shifted.state.keywords).toEqual(["travel"]);
		expect(shifted.state.lowCount).toBe(0);
	});
});
