import { useState, useCallback } from "react";
import type { Sentence } from "@/types/sentence";
import type { Theme } from "@/types/theme";
import { generateEmbeddings } from "@/services/embeddingsClient";
import { storage } from "@/services/storage";

export function useGenerateEmbeddings() {
    const [isGenerating, setIsGenerating] = useState(false);

    const generate = useCallback(async (sentences: Sentence[], fullText: string): Promise<Theme[]> => {
        if (sentences.length === 0) {
            console.log("⚠️ No sentences available for embeddings");
            return [];
        }

        setIsGenerating(true);

        try {
            console.log(`🎯 Generating embeddings for ${sentences.length} sentences`);

            const data = await generateEmbeddings({
                sentences,
                fullText,
            });

            console.log("✨ Embeddings result:", data);

            // Save to localStorage for themes page
            const themes = data.themes || [];
            
            // Verify we got AI-generated themes (not fallbacks)
            const hasRealThemes = themes.some(theme => !theme.label.includes("Theme ") && !theme.label.includes("Cluster "));
            console.log("🎨 AI themes generated:", hasRealThemes, themes.map(t => t.label));
            
            storage.setThemes(themes);
            storage.setText(fullText);

            return themes;
        } catch (error) {
            console.error("❌ Embeddings generation failed:", error);
            throw error;
        } finally {
            setIsGenerating(false);
        }
    }, []);

    return {
        generate,
        isGenerating,
    };
}
