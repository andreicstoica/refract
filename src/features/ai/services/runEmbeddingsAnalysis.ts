"use client";

import type { Sentence } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { generateEmbeddings } from "@/features/ai/services/embeddingsClient";
import { storage } from "@/features/writing/services/storage";
import { debug } from "@/lib/debug";

/**
 * Runs the embeddings remote call and handles local persistence.
 * Separated from React hooks so it can be tested or reused in other contexts.
 */
export async function runEmbeddingsAnalysis(
	sentences: Sentence[],
	fullText: string
): Promise<Theme[]> {
	if (sentences.length === 0) {
		debug.warn("⚠️ No sentences available for embeddings");
		return [];
	}

	debug.dev(`🎯 Generating embeddings for ${sentences.length} sentences`);

	const data = await generateEmbeddings({
		sentences,
		fullText,
	});

	debug.dev("✨ Embeddings result:", data);

	const themes = data.themes || [];

	const hasRealThemes = themes.some(
		(theme) =>
			!theme.label.includes("Theme ") && !theme.label.includes("Cluster ")
	);
	debug.dev("🎨 AI themes generated:", hasRealThemes, themes.map((t) => t.label));

	storage.setThemes(themes);
	storage.setText(fullText);
	storage.setSentences(sentences);

	localStorage.removeItem("refract-analysis");

	return themes;
}
