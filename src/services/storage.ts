import type { Theme } from "@/types/theme";

const STORAGE_KEYS = {
    THEMES: "refract-themes",
    TEXT: "refract-text",
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

    clear(): void {
        localStorage.removeItem(STORAGE_KEYS.THEMES);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
    },
};
