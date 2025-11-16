import { useState, useRef, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { splitIntoSentences, measureSentencePositions, clearPositionCache } from "@/lib/sentences";
import type { Sentence, SentencePosition } from "@/types/sentence";

interface UseSentenceTrackerOptions {
	text: string;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	debounceMs?: number;
	onUpdate?: (text: string, sentences: Sentence[], positions: SentencePosition[]) => void;
}

export function useSentenceTracker({
	text,
	textareaRef,
	debounceMs = 100,
	onUpdate
}: UseSentenceTrackerOptions) {
	const [sentences, setSentences] = useState<Sentence[]>([]);
	const [positions, setPositions] = useState<SentencePosition[]>([]);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);
	const textRef = useRef(text);
	const onUpdateRef = useRef(onUpdate);

	useEffect(() => {
		textRef.current = text;
	}, [text]);

	useEffect(() => {
		onUpdateRef.current = onUpdate;
	}, [onUpdate]);

	const processText = useCallback(() => {
		const currentText = textareaRef.current?.value ?? textRef.current ?? "";

		if (!currentText.trim()) {
			setSentences([]);
			setPositions([]);
			onUpdateRef.current?.(currentText, [], []);
			return;
		}

		const nextSentences = splitIntoSentences(currentText);
		let nextPositions: SentencePosition[] = [];

		if (textareaRef.current && nextSentences.length > 0) {
			nextPositions = measureSentencePositions(nextSentences, textareaRef.current);
		}

		setSentences(nextSentences);
		setPositions(nextPositions);
		onUpdateRef.current?.(currentText, nextSentences, nextPositions);
	}, [textareaRef]);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		const trimmed = text.trimEnd();
		const endsWithPunctuation = /[\n.!?;:]$/.test(trimmed);

		if (!text) {
			processText();
			return;
		}

		if (endsWithPunctuation) {
			processText();
		} else {
			debounceRef.current = setTimeout(processText, debounceMs);
		}

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
				debounceRef.current = null;
			}
		};
	}, [text, debounceMs, processText]);

	const refreshPositions = useCallback(() => {
		if (!textareaRef.current || sentences.length === 0) {
			setPositions([]);
			onUpdateRef.current?.(textRef.current ?? "", sentences, []);
			return;
		}

		const updatedPositions = measureSentencePositions(sentences, textareaRef.current);
		setPositions(updatedPositions);
		onUpdateRef.current?.(textRef.current ?? "", sentences, updatedPositions);
	}, [sentences, textareaRef]);

	useEffect(() => {
		const handleResize = () => {
			if (sentences.length === 0) return;
			clearPositionCache();
			refreshPositions();
		};

		window.addEventListener("resize", handleResize, { passive: true });
		return () => window.removeEventListener("resize", handleResize);
	}, [sentences, refreshPositions]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	return {
		sentences,
		positions,
		refreshPositions
	};
}
