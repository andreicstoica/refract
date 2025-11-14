import { describe, it, expect } from "bun:test";
import { getProdTriggerReason, shouldTriggerProd, SOFT_PUNCT_MIN_CHARS_SINCE, SOFT_PUNCT_MIN_LEN } from "@/lib/prodTriggerRules";
import type { Sentence } from "@/types/sentence";
import type { getTimingConfig } from "@/lib/demoMode";

type TimingConfig = ReturnType<typeof getTimingConfig>;

const baseConfig: TimingConfig = {
	cooldownMs: 500,
	charTrigger: 30,
	settlingMs: 700,
	rateLimitMs: 75,
	trailingDebounceMs: 700,
	emoji: "📝",
};

function makeSentence(text: string): Sentence {
	return {
		id: `s-${text.length}`,
		text,
		startIndex: 0,
		endIndex: text.length,
	};
}

describe("prodTriggerRules", () => {
	describe("shouldTriggerProd", () => {
		it("blocks triggers while within cooldown window", () => {
			const lastSentence = makeSentence("This is a longer thought that should qualify.");
			const now = 1000;
			const lastTriggerAt = now - baseConfig.cooldownMs + 1;
			const canTrigger = shouldTriggerProd({
				currentText: "a".repeat(80),
				lastSentence,
				config: baseConfig,
				lastTriggerAt,
				now,
			});
			expect(canTrigger).toBe(false);
		});

		it("requires enough total text and sentence length when early in session", () => {
			const lastSentence = makeSentence("Too short.");
			const canTrigger = shouldTriggerProd({
				currentText: "a".repeat(10),
				lastSentence,
				config: baseConfig,
				lastTriggerAt: 0,
				now: baseConfig.cooldownMs + 1,
			});
			expect(canTrigger).toBe(false);
		});

		it("allows triggers once cooldown and length checks pass", () => {
			const lastSentence = makeSentence("This sentence contains plenty of detail to be interesting.");
			const canTrigger = shouldTriggerProd({
				currentText: "b".repeat(200),
				lastSentence,
				config: baseConfig,
				lastTriggerAt: 0,
				now: baseConfig.cooldownMs + 1,
			});
			expect(canTrigger).toBe(true);
		});
	});

	describe("getProdTriggerReason", () => {
		it("returns punctuation when text ends with terminal marks", () => {
			const reason = getProdTriggerReason({
				currentText: "Something happened today.",
				lastSentence: makeSentence("Something happened today."),
				lastTriggerCharPos: 0,
				config: baseConfig,
			});
			expect(reason).toBe("punctuation");
		});

		it("returns softComma when comma pause meets length requirements", () => {
			const text = "Lines with a dangling clause,";
			const reason = getProdTriggerReason({
				currentText: text,
				lastSentence: makeSentence(text.padEnd(SOFT_PUNCT_MIN_LEN + 5, "x")),
				lastTriggerCharPos: text.length - SOFT_PUNCT_MIN_CHARS_SINCE,
				config: baseConfig,
			});
			expect(reason).toBe("softComma");
		});

		it("returns charThreshold when enough characters were typed since last trigger", () => {
			const reason = getProdTriggerReason({
				currentText: "a".repeat(baseConfig.charTrigger + 5),
				lastSentence: makeSentence("a".repeat(baseConfig.charTrigger + 5)),
				lastTriggerCharPos: 0,
				config: baseConfig,
			});
			expect(reason).toBe("charThreshold");
		});

		it("returns null when no trigger condition is satisfied", () => {
			const reason = getProdTriggerReason({
				currentText: "short stub",
				lastSentence: makeSentence("short stub"),
				lastTriggerCharPos: "short stub".length - 1,
				config: baseConfig,
			});
			expect(reason).toBeNull();
		});
	});
});
