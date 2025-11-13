"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { Sentence } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { runEmbeddingsAnalysis } from "@/lib/ai/runEmbeddingsAnalysis";

interface EmbeddingsContextValue {
	isGenerating: boolean;
	generateThemes: (
		sentences: Sentence[],
		fullText: string
	) => Promise<Theme[]>;
}

const EmbeddingsContext = createContext<EmbeddingsContextValue | null>(null);

export function EmbeddingsProvider({ children }: { children: ReactNode }) {
	const [isGenerating, setIsGenerating] = useState(false);

	const generateThemes = useCallback(
		async (sentences: Sentence[], fullText: string) => {
			setIsGenerating(true);
			try {
				return await runEmbeddingsAnalysis(sentences, fullText);
			} finally {
				setIsGenerating(false);
			}
		},
		[]
	);

	const value = useMemo(
		() => ({
			isGenerating,
			generateThemes,
		}),
		[isGenerating, generateThemes]
	);

	return (
		<EmbeddingsContext.Provider value={value}>
			{children}
		</EmbeddingsContext.Provider>
	);
}

export function useEmbeddings() {
	const context = useContext(EmbeddingsContext);
	if (!context) {
		throw new Error("useEmbeddings must be used within EmbeddingsProvider");
	}
	return context;
}
