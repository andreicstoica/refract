"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEmbeddings } from "@/features/themes/EmbeddingsProvider";
import { rangesFromThemes } from "@/lib/highlight";
import type { HighlightRange } from "@/types/highlight";
import type { Sentence } from "@/types/sentence";
import type { Theme } from "@/types/theme";

type ThemeAnalysisOptions = {
	sentences: Sentence[];
	text: string;
};

type AnalysisPayload = {
	sentences: Sentence[];
	text: string;
};

export function useThemeAnalysis({ sentences, text }: ThemeAnalysisOptions) {
	const { generateThemes, isGenerating } = useEmbeddings();
	const [themes, setThemes] = useState<Theme[] | null>(null);
	const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
	const latestPayloadRef = useRef<AnalysisPayload | null>(null);

	const hasThemes = Boolean(themes && themes.length > 0);

	// Drop orphaned selections when the theme list changes after a rerun.
	useEffect(() => {
		if (!themes) {
			setSelectedThemeIds([]);
			return;
		}

		setSelectedThemeIds((prev) =>
			prev.filter((id) => themes.some((theme) => theme.id === id))
		);
	}, [themes]);

	const sentenceMap = useMemo(() => {
		const map = new Map<string, Sentence>();
		for (const sentence of sentences) {
			map.set(sentence.id, sentence);
		}
		return map;
	}, [sentences]);

	const allHighlightableRanges = useMemo(
		() => rangesFromThemes(themes, sentenceMap),
		[themes, sentenceMap]
	);

	const highlightRanges: HighlightRange[] = useMemo(() => {
		if (!themes || selectedThemeIds.length === 0) return [];
		return rangesFromThemes(
			themes,
			sentenceMap,
			new Set(selectedThemeIds)
		);
	}, [themes, sentenceMap, selectedThemeIds]);

	const toggleTheme = useCallback((themeId: string) => {
		setSelectedThemeIds((prev) =>
			prev.includes(themeId)
				? prev.filter((id) => id !== themeId)
				: [...prev, themeId]
		);
	}, []);

	const resetThemes = useCallback(() => {
		setThemes(null);
		setSelectedThemeIds([]);
	}, []);

	const runAnalysis = useCallback(
		async (payload?: Partial<AnalysisPayload>) => {
			const finalSentences = payload?.sentences ?? sentences;
			const finalText = payload?.text ?? text;

			latestPayloadRef.current = {
				sentences: finalSentences,
				text: finalText,
			};

			if (finalSentences.length === 0 || !finalText.trim()) {
				setThemes(null);
				return null;
			}

			const result = await generateThemes(finalSentences, finalText);
			setThemes(result?.length ? result : null);
			return result ?? null;
		},
		[generateThemes, sentences, text]
	);

	const rerunAnalysis = useCallback(async () => {
		const payload = latestPayloadRef.current;
		return runAnalysis(
			payload ?? {
				sentences,
				text,
			}
		);
	}, [runAnalysis, sentences, text]);

	return {
		themes,
		selectedThemeIds,
		isGenerating,
		hasThemes,
		allHighlightableRanges,
		highlightRanges,
		toggleTheme,
		resetThemes,
		requestAnalysis: runAnalysis,
		rerunAnalysis,
	};
}
