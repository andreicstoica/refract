import { useEffect, useRef, useCallback } from "react";
import type { Sentence } from "@/types/sentence";
import type { getTimingConfig } from "@/lib/demoMode";
import { splitIntoSentences } from "@/lib/sentences";
import { shouldTriggerProd, getProdTriggerReason } from "@/lib/prodTriggerRules";
import { debug } from "@/lib/debug";

type TimingConfig = ReturnType<typeof getTimingConfig>;

interface UseProdTriggersOptions {
	text: string;
	sentences: Sentence[];
	onTrigger: (fullText: string, lastSentence: Sentence, opts?: { force?: boolean }) => void;
	config: TimingConfig;
	prodsEnabled?: boolean;
}

const WATCHDOG_IDLE_MS = 6000;

export function useProdTriggers({
	text,
	sentences,
	onTrigger,
	config,
	prodsEnabled = true
}: UseProdTriggersOptions) {
	const settlingTimerRef = useRef<NodeJS.Timeout | null>(null);
	const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastTriggerAtRef = useRef(0);
	const lastTriggerCharPosRef = useRef(0);
	const lastInputAtRef = useRef(Date.now());
	const watchdogArmedRef = useRef(true);
	const idleLockRef = useRef(false);
	const textRef = useRef(text);
	const sentencesRef = useRef(sentences);

	useEffect(() => {
		textRef.current = text;
		lastInputAtRef.current = Date.now();
		watchdogArmedRef.current = true;
		idleLockRef.current = false;
	}, [text]);

	useEffect(() => {
		sentencesRef.current = sentences;
	}, [sentences]);

	const triggerProd = useCallback(
		(fullText: string, lastSentence: Sentence, opts?: { force?: boolean }) => {
			if (!prodsEnabled) {
				debug.dev(`${config.emoji} ⏸️ Prods disabled; skipping trigger`);
				return;
			}

			debug.dev(`${config.emoji} 🚀 Triggering prod for sentence:`, lastSentence.text);
			onTrigger(fullText, lastSentence, opts);
			lastTriggerAtRef.current = Date.now();
			lastTriggerCharPosRef.current = fullText.length;
			if (opts?.force) {
				idleLockRef.current = true;
			}
		},
		[onTrigger, prodsEnabled, config]
	);

	const scheduleSettlingTrigger = useCallback(() => {
		if (settlingTimerRef.current) {
			clearTimeout(settlingTimerRef.current);
		}

		settlingTimerRef.current = setTimeout(() => {
			const latestText = textRef.current ?? "";
			const latestSentences = sentencesRef.current ?? [];
			if (!latestText.trim() || latestSentences.length === 0) {
				return;
			}

			const lastSentence = latestSentences[latestSentences.length - 1];
			if (
				!shouldTriggerProd({
					currentText: latestText,
					lastSentence,
					config,
					lastTriggerAt: lastTriggerAtRef.current
				})
			) {
				return;
			}

			triggerProd(latestText, lastSentence);
		}, config.settlingMs);
	}, [config, triggerProd]);

	const evaluateTriggers = useCallback(() => {
		if (idleLockRef.current) {
			return;
		}

		if (!text.trim()) {
			if (settlingTimerRef.current) {
				clearTimeout(settlingTimerRef.current);
				settlingTimerRef.current = null;
			}
			return;
		}

		if (sentences.length === 0) {
			if (settlingTimerRef.current) {
				clearTimeout(settlingTimerRef.current);
				settlingTimerRef.current = null;
			}
			return;
		}

		const lastSentence = sentences[sentences.length - 1];
		if (!lastSentence || !lastSentence.text.trim()) {
			return;
		}

		const canTrigger = shouldTriggerProd({
			currentText: text,
			lastSentence,
			config,
			lastTriggerAt: lastTriggerAtRef.current
		});

		if (!canTrigger) {
			return;
		}

		const reason = getProdTriggerReason({
			currentText: text,
			lastSentence,
			lastTriggerCharPos: lastTriggerCharPosRef.current,
			config
		});

		if (reason) {
			debug.dev(`${config.emoji} ⚙️ Trigger fired via ${reason}`);
			triggerProd(text, lastSentence);
			return;
		}

		debug.dev(`${config.emoji} ⏳ Waiting for settling (${config.settlingMs}ms)`);
		scheduleSettlingTrigger();
	}, [text, sentences, config, triggerProd, scheduleSettlingTrigger]);

	useEffect(() => {
		evaluateTriggers();
	}, [evaluateTriggers]);

	useEffect(() => {
		if (watchdogTimerRef.current) {
			clearInterval(watchdogTimerRef.current as unknown as number);
		}

		watchdogTimerRef.current = setInterval(() => {
			const now = Date.now();
			const idleMs = now - lastInputAtRef.current;

			if (idleMs >= WATCHDOG_IDLE_MS && watchdogArmedRef.current) {
				const latestText = textRef.current ?? "";
				const currentSentences =
					sentencesRef.current.length > 0 ? sentencesRef.current : splitIntoSentences(latestText);

				if (currentSentences.length === 0) {
					return;
				}

				const lastSentence = currentSentences[currentSentences.length - 1];
				debug.dev(`${config.emoji} ⏰ Watchdog forcing prod after inactivity`);
				triggerProd(latestText, lastSentence, { force: true });
				watchdogArmedRef.current = false;
			}
		}, 1000);

		return () => {
			if (watchdogTimerRef.current) {
				clearInterval(watchdogTimerRef.current as unknown as number);
			}
		};
	}, [triggerProd, config]);

	useEffect(() => {
		return () => {
			if (settlingTimerRef.current) {
				clearTimeout(settlingTimerRef.current);
			}
		};
	}, []);
}
