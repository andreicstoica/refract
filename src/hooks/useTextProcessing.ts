import { useState, useRef, useEffect, useCallback } from "react";
import { splitIntoSentences } from "@/lib/sentences";
import type { Sentence } from "@/types/sentence";
import { measureSentencePositions } from "@/lib/position";
import type { SentencePosition } from "@/types/sentence";

interface UseTextProcessingOptions {
    onProdTrigger: (fullText: string, lastSentence: Sentence) => void;
    onTextChange?: (text: string) => void;
    onTextUpdate?: (
        text: string,
        sentences: Sentence[],
        positions: SentencePosition[]
    ) => void;
}

const COOLDOWN_MS = 1200;
const CHAR_TRIGGER = 60;
const TRAILING_DEBOUNCE_MS = 1500;

export function useTextProcessing({
    onProdTrigger,
    onTextChange,
    onTextUpdate,
}: UseTextProcessingOptions) {
    const [text, setText] = useState("");
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [sentencePositions, setSentencePositions] = useState<SentencePosition[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const positionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sentencesDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // New trigger state tracking
    const lastTriggerAtRef = useRef<number>(0);
    const lastTriggerCharPosRef = useRef<number>(0);
    const lastTriggerSentenceIdRef = useRef<string | null>(null);
    const lastTriggerSentenceTextRef = useRef<string | null>(null);

    // Position measurement with memoization
    const measurePositions = useCallback(
        (sentences: Sentence[], textarea: HTMLTextAreaElement) => {
            return measureSentencePositions(sentences, textarea) as SentencePosition[];
        },
        []
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

        // Check if we've already processed this exact sentence (ID + content)
        if (lastTriggerSentenceIdRef.current === lastSentence.id &&
            lastTriggerSentenceTextRef.current === lastSentence.text) {
            console.log("🔄 Already processed exact sentence:", lastSentence.text.substring(0, 30) + "...");
            return false;
        }

        console.log("✅ Should trigger prod for:", lastSentence.text.substring(0, 30) + "...");
        return true;
    }, []);

    // Helper to trigger prod and update tracking state
    const triggerProd = useCallback((currentText: string, lastSentence: Sentence) => {
        console.log("🚀 Triggering prod for sentence:", lastSentence.text);
        onProdTrigger(currentText, lastSentence);
        lastTriggerAtRef.current = Date.now();
        lastTriggerCharPosRef.current = currentText.length;
        lastTriggerSentenceIdRef.current = lastSentence.id;
        lastTriggerSentenceTextRef.current = lastSentence.text;
    }, [onProdTrigger]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
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

            // Delay position calculation to ensure accurate positioning after React paints
            if (positionTimerRef.current) {
                clearTimeout(positionTimerRef.current);
            }
            positionTimerRef.current = setTimeout(() => {
                if (textareaRef.current && newSentences.length > 0) {
                    const positions = measurePositions(newSentences, textareaRef.current);
                    setSentencePositions(positions);
                    if (process.env.NODE_ENV !== "production") console.log("📍 Updated sentence positions:", positions.length, "positions");
                }
            }, 100);
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

    // Handle scroll and resize events to reposition chips
    useEffect(() => {
        let rafPending = false;
        const handleRepositionRAF = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                if (textareaRef.current && sentences.length > 0) {
                    const positions = measurePositions(sentences, textareaRef.current);
                    setSentencePositions(positions);
                }
            });
        };

        const textarea = textareaRef.current;
        if (textarea) {
            textarea.addEventListener("scroll", handleRepositionRAF);
            window.addEventListener("resize", handleRepositionRAF);

            return () => {
                textarea.removeEventListener("scroll", handleRepositionRAF);
                window.removeEventListener("resize", handleRepositionRAF);
            };
        }
    }, [sentences, measurePositions]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (positionTimerRef.current) {
                clearTimeout(positionTimerRef.current);
            }
        };
    }, []);

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
