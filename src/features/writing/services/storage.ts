import { debug } from "@/lib/debug";
import type { Sentence } from "@/types/sentence";
import type { Theme } from "@/types/theme";

const STORAGE_KEYS = {
    THEMES: "refract-themes",
    TEXT: "refract-text",
    SENTENCES: "refract-sentences",
    HAS_SEEN_INTRO: "refract-has-seen-intro",
} as const;

/**
 * Centralized localStorage helpers for Refract app data
 */
export const storage = {
    getThemes(): Theme[] | null {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.THEMES);
            if (!saved) return null;
            const parsed: Theme[] = JSON.parse(saved);
            // Migration: ensure per-chunk correlation exists; if not, invalidate cached themes
            const needsMigration = Array.isArray(parsed) && parsed.some((t) =>
                Array.isArray(t.chunks) && t.chunks.length > 0 && t.chunks.some((c: any) => typeof c?.correlation !== "number")
            );
            if (needsMigration) {
                debug.dev("Refract: clearing cached themes without correlation; will regenerate.");
                localStorage.removeItem(STORAGE_KEYS.THEMES);
                return null;
            }
            return parsed;
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

    getHasSeenIntro(): boolean {
        return localStorage.getItem(STORAGE_KEYS.HAS_SEEN_INTRO) === "true";
    },

    setHasSeenIntro(hasSeen: boolean): void {
        localStorage.setItem(STORAGE_KEYS.HAS_SEEN_INTRO, hasSeen.toString());
    },

    clear(): void {
        localStorage.removeItem(STORAGE_KEYS.THEMES);
        localStorage.removeItem(STORAGE_KEYS.TEXT);
        localStorage.removeItem(STORAGE_KEYS.SENTENCES);
    },
};
