import { useState, useRef, useEffect, useCallback } from "react";
import { splitIntoSentences } from "@/utils/sentenceUtils";
import type { Sentence } from "@/types/sentence";
import { measureSentencePositions } from "@/utils/positionUtils";
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

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        onTextChange?.(newText);

        // Update sentences using utility function
        const newSentences = splitIntoSentences(newText);
        setSentences(newSentences);

        // Immediate position update for better sync
        if (textareaRef.current && newSentences.length > 0) {
            const positions = measurePositions(newSentences, textareaRef.current);
            setSentencePositions(positions);
        }

        // Debounced position update for fine-tuning
        if (positionTimerRef.current) {
            clearTimeout(positionTimerRef.current);
        }

        positionTimerRef.current = setTimeout(() => {
            if (textareaRef.current && newSentences.length > 0) {
                const positions = measurePositions(newSentences, textareaRef.current);
                setSentencePositions(positions);
            }
        }, 50);

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Check for punctuation trigger (sentence ending)
        const hasPunctuation = /[.!?;:]\s*$/.test(newText.trim());

        if (hasPunctuation && newSentences.length > 0) {
            console.log("⚙️ Punctuation trigger detected");
            const lastSentence = newSentences[newSentences.length - 1];
            onProdTrigger(newText, lastSentence);
        } else {
            // Set 3-second debounce timer
            console.log("⏳ Setting 3s debounce timer");
            debounceTimerRef.current = setTimeout(() => {
                const currentText = textareaRef.current?.value || "";
                const currentSentences = splitIntoSentences(currentText);
                if (currentSentences.length > 0) {
                    const lastSentence = currentSentences[currentSentences.length - 1];
                    onProdTrigger(currentText, lastSentence);
                }
            }, 3000);
        }
    };

    // Handle scroll and resize events to reposition chips
    useEffect(() => {
        const handleReposition = () => {
            if (textareaRef.current && sentences.length > 0) {
                const positions = measurePositions(sentences, textareaRef.current);
                setSentencePositions(positions);
            }
        };

        const textarea = textareaRef.current;
        if (textarea) {
            textarea.addEventListener("scroll", handleReposition);
            window.addEventListener("resize", handleReposition);

            return () => {
                textarea.removeEventListener("scroll", handleReposition);
                window.removeEventListener("resize", handleReposition);
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
