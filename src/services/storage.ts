import type { Theme } from "@/types/theme";
import type { Sentence } from "@/types/sentence";

const STORAGE_KEYS = {
    THEMES: "refract-themes",
    TEXT: "refract-text",
    SENTENCES: "refract-sentences",
} as const;

/**
 * Centralized localStorage helpers for Refract app data
 */
export const storage = {
    getThemes(): Theme[] | null {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.THEMES);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    },

    setThemes(themes: Theme[]): void {
        localStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(themes));
    },

    getText(): string | null {
        return localStorage.getItem(STORAGE_KEYS.TEXT);
    },

    setText(text: string): void {
        localStorage.setItem(STORAGE_KEYS.TEXT, text);
    },

    getSentences(): Sentence[] | null {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.SENTENCES);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    },

    setSentences(sentences: Sentence[]): void {
        localStorage.setItem(STORAGE_KEYS.SENTENCES, JSON.stringify(sentences));
    },

    clear(): void {
        localStorage.removeItem(STORAGE_KEYS.THEMES);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
        localStorage.removeItem(STORAGE_KEYS.SENTENCES);
    },
};
