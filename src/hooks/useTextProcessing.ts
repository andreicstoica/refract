import { useState, useRef, useEffect, useCallback } from "react";
import { splitIntoSentences } from "@/lib/sentences";
import type { Sentence } from "@/types/sentence";
import { measureSentencePositions, clearPositionCache } from "@/lib/sentences";
import type { SentencePosition } from "@/types/sentence";
import { useRafScroll } from "@/lib/useRafScroll";


interface UseTextProcessingOptions {
    onProdTrigger: (fullText: string, lastSentence: Sentence, opts?: { force?: boolean }) => void;
    onTextChange?: (text: string) => void;
    onTextUpdate?: (
        text: string,
        sentences: Sentence[],
        positions: SentencePosition[]
    ) => void;
    prodsEnabled?: boolean;
}

const COOLDOWN_MS = 500; // allow more frequent triggers
// Lower character threshold so mid-sentence nudges appear sooner
const CHAR_TRIGGER = 30;
const TRAILING_DEBOUNCE_MS = 700;
// Soft punctuation guards (more permissive)
const SOFT_PUNCT_MIN_LEN = 25; // require some context
const SOFT_PUNCT_MIN_CHARS_SINCE = 8; // avoid over-firing on tiny pauses

export function useTextProcessing({
    onProdTrigger,
    onTextChange,
    onTextUpdate,
    prodsEnabled = true,
}: UseTextProcessingOptions) {
    const [text, setText] = useState("");
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [sentencePositions, setSentencePositions] = useState<SentencePosition[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sentencesDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastWatchdogFireRef = useRef<number>(0);

    // Basic tracking for triggers and watchdog
    const lastTriggerAtRef = useRef<number>(0);
    const lastTriggerCharPosRef = useRef<number>(0);
    const lastInputAtRef = useRef<number>(Date.now());
    const watchdogArmedRef = useRef<boolean>(true);

    // Position measurement with memoization
    const measurePositions = useCallback(
        (sentences: Sentence[], textarea: HTMLTextAreaElement) => {
            return measureSentencePositions(sentences, textarea) as SentencePosition[];
        },
        []
    );

    // Immediate position measurement (no debouncing needed)
    const updatePositions = useCallback(
        (sentences: Sentence[], textarea: HTMLTextAreaElement) => {
            if (textarea && sentences.length > 0) {
                const positions = measurePositions(sentences, textarea);
                setSentencePositions(positions);
                if (process.env.NODE_ENV !== "production") console.log("📍 Updated sentence positions:", positions.length, "positions");
            }
        },
        [measurePositions]
    );

    // Focus on mount and auto-scroll to cursor
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    // Auto-scroll to cursor when text changes
    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.scrollTop = textarea.scrollHeight;
        }
    }, [text]);

    // Helper to check if we should trigger a prod
    const shouldTriggerProd = useCallback((currentText: string, lastSentence: Sentence) => {
        const now = Date.now();

        // Check cooldown
        if (now - lastTriggerAtRef.current < COOLDOWN_MS) {
            console.log("⏰ Cooldown active, skipping trigger for:", lastSentence.text.substring(0, 30) + "...");
            return false;
        }

        console.log("✅ Should trigger prod for:", lastSentence.text.substring(0, 30) + "...");
        return true;
    }, []);

    // Helper to trigger prod and update tracking state
    const triggerProd = useCallback((currentText: string, lastSentence: Sentence, opts?: { force?: boolean }) => {
        console.log("🚀 Triggering prod for sentence:", lastSentence.text);
        if (prodsEnabled) {
            onProdTrigger(currentText, lastSentence, opts);
        } else {
            if (process.env.NODE_ENV !== "production") console.log("⏸️ Prods disabled; skipping trigger");
        }

        // Update tracking state
        lastTriggerAtRef.current = Date.now();
        lastTriggerCharPosRef.current = currentText.length;
    }, [onProdTrigger, prodsEnabled]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        lastInputAtRef.current = Date.now();
        watchdogArmedRef.current = true; // re-arm watchdog on user input
        setText(newText);
        onTextChange?.(newText);

        // Clear any existing sentence split debounce
        if (sentencesDebounceRef.current) {
            clearTimeout(sentencesDebounceRef.current);
        }

        const runSplitAndTriggers = () => {
            const currentText = textareaRef.current?.value ?? newText;
            const newSentences = splitIntoSentences(currentText);
            setSentences(newSentences);

            if (newSentences.length === 0) return;

            const lastSentence = newSentences[newSentences.length - 1];
            const trimmed = currentText.trimEnd();
            const hasPunctuation = /[.!?;:]$/.test(trimmed);
            const hasSoftComma = /[,]$/.test(trimmed);
            const charsSince = currentText.length - lastTriggerCharPosRef.current;

            if (process.env.NODE_ENV !== "production") {
                console.log("🔍 Trigger analysis:", {
                    sentenceText: lastSentence.text.substring(0, 50) + "...",
                    hasPunctuation,
                    charsSince,
                    sentenceLength: lastSentence.text.length,
                    shouldTrigger: shouldTriggerProd(currentText, lastSentence)
                });
            }

            // Clear trailing debounce if any before setting a new one
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            if (shouldTriggerProd(currentText, lastSentence)) {
                if (hasPunctuation) {
                    if (process.env.NODE_ENV !== "production") console.log("⚙️ Punctuation trigger detected");
                    triggerProd(currentText, lastSentence);
                } else if (hasSoftComma && lastSentence.text.length >= SOFT_PUNCT_MIN_LEN && charsSince >= SOFT_PUNCT_MIN_CHARS_SINCE) {
                    if (process.env.NODE_ENV !== "production") console.log("⚙️ Soft comma trigger detected");
                    triggerProd(currentText, lastSentence);
                } else if (charsSince >= CHAR_TRIGGER) {
                    if (process.env.NODE_ENV !== "production") console.log("⚙️ Character threshold trigger detected");
                    triggerProd(currentText, lastSentence);
                } else {
                    if (process.env.NODE_ENV !== "production") console.log("⏳ Setting trailing debounce timer");
                    debounceTimerRef.current = setTimeout(() => {
                        const latestText = textareaRef.current?.value || "";
                        const currentSentences = splitIntoSentences(latestText);
                        if (currentSentences.length > 0) {
                            const lastSentence2 = currentSentences[currentSentences.length - 1];
                            if (shouldTriggerProd(latestText, lastSentence2)) {
                                triggerProd(latestText, lastSentence2);
                            }
                        }
                    }, TRAILING_DEBOUNCE_MS);
                }
            } else {
                if (process.env.NODE_ENV !== "production") console.log("❌ Trigger conditions not met for:", lastSentence.text.substring(0, 30) + "...");
            }

            // Update positions immediately
            if (textareaRef.current && newSentences.length > 0) {
                updatePositions(newSentences, textareaRef.current);
            }
        };

        // If terminal punctuation, flush immediately; else debounce splitting
        const trimmed = newText.trimEnd();
        const endsWithPunct = /[.!?;:]$/.test(trimmed);
        if (endsWithPunct) {
            runSplitAndTriggers();
        } else {
            sentencesDebounceRef.current = setTimeout(runSplitAndTriggers, 200);
        }
    };

    // Handle scroll events to reposition chips using RAF coalescing
    const handleScrollReposition = useCallback((element: HTMLElement) => {
        if (sentences.length > 0) {
            clearPositionCache();
            updatePositions(sentences, element as HTMLTextAreaElement);
            if (process.env.NODE_ENV !== "production") console.log("🔄 Repositioned chips after scroll (RAF)");
        }
    }, [sentences, updatePositions]);

    useRafScroll(textareaRef, handleScrollReposition, [sentences, updatePositions]);

    // Handle resize events to reposition chips
    useEffect(() => {
        const handleReposition = () => {
            if (textareaRef.current && sentences.length > 0) {
                clearPositionCache();
                updatePositions(sentences, textareaRef.current);
                if (process.env.NODE_ENV !== "production") console.log("🔄 Repositioned chips after resize");
            }
        };

        window.addEventListener("resize", handleReposition, { passive: true });
        return () => window.removeEventListener("resize", handleReposition);
    }, [sentences, updatePositions]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (sentencesDebounceRef.current) {
                clearTimeout(sentencesDebounceRef.current);
            }
            if (watchdogTimerRef.current) {
                clearTimeout(watchdogTimerRef.current);
            }
        };
    }, []);

    // Watchdog: if user is idle for ~8s, nudge with a forced prod
    useEffect(() => {
        if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current as unknown as number);
        }
        watchdogTimerRef.current = setInterval(() => {
            const now = Date.now();
            const idleMs = now - lastInputAtRef.current;

            if (idleMs >= 6000 && watchdogArmedRef.current) {
                const latestText = textareaRef.current?.value || text;
                const currentSentences = sentences.length > 0 ? sentences : splitIntoSentences(latestText);
                if (currentSentences.length > 0) {
                    const lastSentence = currentSentences[currentSentences.length - 1];
                    // Force a prod even if normal filters would skip
                    triggerProd(latestText, lastSentence, { force: true });
                    watchdogArmedRef.current = false; // fire once until user types again
                    lastWatchdogFireRef.current = now;
                }
            }
        }, 1000);

        return () => {
            if (watchdogTimerRef.current) {
                clearInterval(watchdogTimerRef.current as unknown as number);
            }
        };
    }, [text, sentences, triggerProd]);

    // Notify parent of text updates
    useEffect(() => {
        onTextUpdate?.(text, sentences, sentencePositions);
    }, [text, sentences, sentencePositions, onTextUpdate]);

    // Calculate layout properties
    const hasContent = text.trim().length > 0;
    const lineCount = text.split("\n").length;
    const shouldUseFullHeight = hasContent && (text.length > 400 || lineCount > 10);

    return {
        text,
        sentences,
        sentencePositions,
        textareaRef,
        handleTextChange,
        layout: {
            hasContent,
            lineCount,
            shouldUseFullHeight,
        },
    };
}
