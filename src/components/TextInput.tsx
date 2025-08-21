"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/helpers";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";
import { useProds } from "@/hooks/useProds";
import { useTopicShiftDetection } from "@/hooks/useTopicShiftDetection";
import { useTextProcessing } from "@/hooks/useTextProcessing";
import { ChipOverlay } from "./ChipOverlay";
import { TEXTAREA_CLASSES } from "@/lib/constants";

interface TextInputProps {
  onTextChange?: (text: string) => void;
  placeholder?: string;
  onTextUpdate?: (
    text: string,
    sentences: Sentence[],
    positions: SentencePosition[]
  ) => void;
}

export function TextInput({
  onTextChange,
  placeholder = "What's on your mind?",
  onTextUpdate,
}: TextInputProps) {
  // State for managing text and topic detection
  const [currentText, setCurrentText] = useState("");
  const currentKeywordsRef = useRef<string[]>([]);

  // Topic shift detection (needs to be first to get keywords for prod system)
  const { hasTopicShift, currentKeywords, topicVersion } =
    useTopicShiftDetection({
      text: currentText,
      onTopicShift: () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("🌟 Topic shift detected in TextInput");
        }
      },
    });

  // Update keywords ref when they change
  useEffect(() => {
    currentKeywordsRef.current = currentKeywords;
  }, [currentKeywords]);

  // Enhanced prod management with topic shift integration
  const onProdTopicShift = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("🎯 Topic shift handled by prod system");
    }
  }, []);

  const {
    prods,
    callProdAPI,
    clearQueue,
    handleTopicShift,
    queueState,
    filteredSentences,
    prodMetrics,
  } = useProds({
    onTopicShift: onProdTopicShift,
    topicKeywords: currentKeywordsRef.current,
    topicVersion,
  });

  // Text processing with prod triggering
  const { text, sentences, sentencePositions, textareaRef, handleTextChange } =
    useTextProcessing({
      onProdTrigger: callProdAPI,
      onTextChange: (newText) => {
        setCurrentText(newText);
        onTextChange?.(newText);
      },
      onTextUpdate,
    });

  // Connect topic shift to prod cancellation (avoid calling during render)
  useEffect(() => {
    if (hasTopicShift) {
      handleTopicShift();
    }
  }, [hasTopicShift, handleTopicShift]);

  return (
    <div className="relative h-full w-full">
      {/* Static centered container */}
      <div className="mx-auto max-w-2xl w-full h-full px-4">
        <div className={cn("h-full overflow-hidden flex flex-col min-h-0")}>
          {/* Scrollable writing area fills remaining height */}
          <div className="relative flex-1 min-h-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder={placeholder}
              className={cn(
                `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex`,
                "py-6 h-full"
              )}
              style={{
                caretColor: "currentColor",
                overflowY: "auto",
                overflowX: "hidden",
                resize: "none",
                lineHeight: "3.5rem",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onWheelCapture={(e) => e.stopPropagation()}
              onPaste={(e) => {
                // Prevent the page from scrolling when pasting
                e.stopPropagation();
                // Small delay to ensure the paste event is handled before any scroll attempts
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }, 0);
              }}
              onKeyDown={(e) => {
                // Prevent page scroll on arrow keys when textarea is focused
                if (
                  [
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "PageUp",
                    "PageDown",
                  ].includes(e.key)
                ) {
                  e.stopPropagation();
                }
              }}
            />

            {/* Top gradient overlay for smooth transition from timer */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />

            {/* Chip Overlay - positioned relative to textarea container */}
            <ChipOverlay
              visibleProds={prods}
              sentencePositions={sentencePositions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
