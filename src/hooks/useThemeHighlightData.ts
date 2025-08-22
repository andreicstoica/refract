"use client";

import { useState, useEffect, useMemo } from "react";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import type { HighlightRange } from "@/types/highlight";
import { storage } from "@/services/storage";
import { rangesFromThemes } from "@/lib/highlight";

type UseThemeHighlightDataProps = {
    propThemes?: Theme[];
    propFullText?: string;
    propSentences?: Sentence[];
    disableStorageFallback?: boolean;
};

export function useThemeHighlightData({ propThemes, propFullText, propSentences, disableStorageFallback }: UseThemeHighlightDataProps) {
    const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
    const [themes, setThemes] = useState<Theme[] | null>(null);
    const [fullText, setFullText] = useState<string>("");
    const [sentences, setSentences] = useState<Sentence[] | null>(null);

    // Load data from props first; optionally skip any storage fallback (for combined page)
    useEffect(() => {
        if (disableStorageFallback) {
            // Only adopt provided props; do not read storage
            if (propThemes !== undefined) setThemes(propThemes);
            if (typeof propFullText === "string") setFullText(propFullText);
            if (propSentences !== undefined) setSentences(propSentences);
            return;
        }

        const storedThemes = propThemes || storage.getThemes();
        const storedText = propFullText ?? storage.getText() ?? "";
        const storedSentences = propSentences || storage.getSentences();

        if (storedThemes && storedThemes.length) setThemes(storedThemes);
        if (storedText) setFullText(storedText);
        if (storedSentences && storedSentences.length) setSentences(storedSentences);
    }, [propThemes, propFullText, propSentences, disableStorageFallback]);

    // Poll storage briefly if data isn't ready yet (e.g., during fresh analysis)
    useEffect(() => {
        if (disableStorageFallback) return;
        if (themes && fullText) return;

        let attempts = 0;
        const interval = setInterval(() => {
            let updated = false;

            if (!themes) {
                const nextThemes = storage.getThemes();
                if (nextThemes && nextThemes.length) {
                    setThemes(nextThemes);
                    updated = true;
                }
            }

            if (!fullText) {
                const nextText = storage.getText();
                if (nextText && nextText.length) {
                    setFullText(nextText);
                    updated = true;
                }
            }

            if ((themes && fullText) || updated) {
                // If either got updated, and both now exist, clear interval
                if ((themes || updated) && (fullText || storage.getText())) {
                    if ((themes || storage.getThemes()) && (fullText || storage.getText())) {
                        clearInterval(interval);
                    }
                }
            }

            attempts++;
            if (attempts >= 120) {
                // ~60s timeout at 500ms interval
                clearInterval(interval);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [themes, fullText, disableStorageFallback]);

    // Build sentence lookup map once
    const sentenceMap = useMemo(() => {
        const map = new Map<string, Sentence>();
        if (sentences) {
            for (const sentence of sentences) {
                map.set(sentence.id, sentence);
            }
        }
        return map;
    }, [sentences]);

    // All possible ranges (stable segmentation)
    const allHighlightableRanges = useMemo(
        () => rangesFromThemes(themes, sentenceMap),
        [themes, sentenceMap]
    );

    // Currently active ranges (selected themes only)
    const highlightRanges = useMemo(() => {
        if (!themes || selectedThemeIds.length === 0) return [];
        return rangesFromThemes(themes, sentenceMap, new Set(selectedThemeIds));
    }, [themes, selectedThemeIds, sentenceMap]);

    const toggleTheme = (themeId: string) => {
        setSelectedThemeIds((prev) =>
            prev.includes(themeId)
                ? prev.filter((id) => id !== themeId)
                : [...prev, themeId]
        );
    };

    return {
        themes,
        fullText,
        selectedThemeIds,
        highlightRanges,
        allHighlightableRanges,
        toggleTheme,
        isLoading: !themes || !fullText,
    };
}
