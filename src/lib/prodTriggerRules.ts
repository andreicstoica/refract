import type { Sentence } from "@/types/sentence";
import type { getTimingConfig } from "@/lib/demoMode";

type TimingConfig = ReturnType<typeof getTimingConfig>;

const EARLY_TEXT_MIN_CHARS = 50;
const EARLY_SENTENCE_MIN_CHARS = 20;
export const SOFT_PUNCT_MIN_LEN = 25;
export const SOFT_PUNCT_MIN_CHARS_SINCE = 8;

export type ProdTriggerReason = "punctuation" | "softComma" | "charThreshold";

interface ShouldTriggerProdParams {
	currentText: string;
	lastSentence: Sentence;
	config: TimingConfig;
	lastTriggerAt: number;
	now?: number;
}

interface TriggerReasonParams {
	currentText: string;
	lastSentence: Sentence;
	lastTriggerCharPos: number;
	config: TimingConfig;
}

export function shouldTriggerProd({
	currentText,
	lastSentence,
	config,
	lastTriggerAt,
	now = Date.now()
}: ShouldTriggerProdParams): boolean {
	if (now - lastTriggerAt < config.cooldownMs) {
		return false;
	}

	const charsSoFar = currentText.length;
	if (charsSoFar < EARLY_TEXT_MIN_CHARS && lastSentence.text.length < EARLY_SENTENCE_MIN_CHARS) {
		return false;
	}

	return true;
}

export function getProdTriggerReason({
	currentText,
	lastSentence,
	lastTriggerCharPos,
	config
}: TriggerReasonParams): ProdTriggerReason | null {
	const trimmed = currentText.trimEnd();
	const hasTerminalPunctuation = /[\n.!?;:]$/.test(trimmed);
	if (hasTerminalPunctuation) {
		return "punctuation";
	}

	const hasSoftComma = /[,]$/.test(trimmed);
	const charsSinceLastTrigger = Math.max(0, currentText.length - lastTriggerCharPos);

	if (
		hasSoftComma &&
		lastSentence.text.length >= SOFT_PUNCT_MIN_LEN &&
		charsSinceLastTrigger >= SOFT_PUNCT_MIN_CHARS_SINCE
	) {
		return "softComma";
	}

	if (charsSinceLastTrigger >= config.charTrigger) {
		return "charThreshold";
	}

	return null;
}
