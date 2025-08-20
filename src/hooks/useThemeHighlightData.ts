"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";
import type { HighlightRange } from "@/types/highlight";
import { storage } from "@/services/storage";
import { rangesFromThemes } from "@/utils/highlightUtils";

type UseThemeHighlightDataProps = {
    propThemes?: Theme[];
};

export function useThemeHighlightData({ propThemes }: UseThemeHighlightDataProps) {
    const router = useRouter();
    const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
    const [themes, setThemes] = useState<Theme[] | null>(null);
    const [fullText, setFullText] = useState<string>("");
    const [sentences, setSentences] = useState<Sentence[] | null>(null);
    // Track initial loading state for data check and potential redirect
    const [isInitializing, setIsInitializing] = useState(true);

    // Load data from storage on mount
    useEffect(() => {
        const storedThemes = propThemes || storage.getThemes();
        const storedText = storage.getText();
        const storedSentences = storage.getSentences();

        if (!storedText || !storedThemes?.length) {
            // Redirect to write page if no data
            // Note: We don't set isInitializing to false here since we're redirecting
            router.push("/write");
            return;
        }

        setThemes(storedThemes);
        setFullText(storedText);
        setSentences(storedSentences);
        setIsInitializing(false);
    }, [propThemes, router]);

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
        isLoading: isInitializing || !themes || !fullText,
    };
}
