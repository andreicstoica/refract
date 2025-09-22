import { useState, useEffect, useRef } from "react";
import { extractKeywords, updateTopicState, type TopicState } from "@/lib/topic";

interface UseTopicShiftDetectionOptions {
    text: string;
    onTopicShift?: (newKeywords: string[], oldKeywords: string[]) => void;
}

export function useTopicShiftDetection({
    text,
    onTopicShift,
}: UseTopicShiftDetectionOptions) {
    const [topicState, setTopicState] = useState<TopicState>({
        keywords: [],
        emaOverlap: 0.5, // Start neutral
        lowCount: 0,
        lastUpdate: Date.now(),
    });

    const [hasTopicShift, setHasTopicShift] = useState(false);
    const [topicVersion, setTopicVersion] = useState(0);
    type TopicShiftCb = (newKeywords: string[], oldKeywords: string[]) => void;
    const onTopicShiftRef = useRef<TopicShiftCb | undefined>(onTopicShift);

    // Keep a stable ref to the callback to avoid effect churn
    useEffect(() => {
        onTopicShiftRef.current = onTopicShift;
    }, [onTopicShift]);

    // Process text when it changes
    useEffect(() => {
        if (!text.trim()) return;

        const newKeywords = extractKeywords(text);
        if (newKeywords.length === 0) return;

        // Use functional update to avoid depending on topicState
        setTopicState((prev) => {
            const { shift, state } = updateTopicState(newKeywords, prev);

            if (shift) {
                setHasTopicShift(true);
                onTopicShiftRef.current?.(newKeywords, prev.keywords);
                setTopicVersion((v) => v + 1);
            }

            return state;
        });
    }, [text]);

    // Reset shift flag after a short delay
    useEffect(() => {
        if (hasTopicShift) {
            const timer = setTimeout(() => {
                setHasTopicShift(false);
            }, 100); // Reset after 100ms

            return () => clearTimeout(timer);
        }
    }, [hasTopicShift]);

    return {
        topicState,
        hasTopicShift,
        currentKeywords: topicState.keywords,
        lastUpdate: topicState.lastUpdate,
        topicVersion,
    };
}
