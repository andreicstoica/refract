"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  onTextareaRef?: (el: HTMLTextAreaElement | null) => void;
  children?: React.ReactNode;
  prodsEnabled?: boolean;
  extraTopPaddingPx?: number;
}

export function TextInput({
  onTextChange,
  placeholder = "What's on your mind?",
  onTextUpdate,
  onTextareaRef,
  children,
  prodsEnabled = true,
  extraTopPaddingPx = 0,
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

  const { prods, callProdAPI, injectProd, handleTopicShift, pinProd, removeProd } = useProds({
    onTopicShift: onProdTopicShift,
    topicKeywords: currentKeywordsRef.current,
    topicVersion,
  });

  // Text processing with prod triggering
  const { text, sentences, sentencePositions, textareaRef, handleTextChange } =
    useTextProcessing({
      onProdTrigger: callProdAPI,
      onImmediateProd: (fullText, sentence, prodText) => injectProd(fullText, sentence, prodText),
      onTextChange: (newText) => {
        setCurrentText(newText);
        onTextChange?.(newText);
      },
      onTextUpdate,
      prodsEnabled,
    });

  // Expose textarea ref to parent once and on handler change
  useEffect(() => {
    onTextareaRef?.(textareaRef.current);
    return () => {
      onTextareaRef?.(null);
    };
  }, [onTextareaRef]);

  // Simplified caret auto-scroll functionality for keyboard visibility
  const ensureCaretVisible = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const visualViewport = window.visualViewport;

    // Only proceed if Visual Viewport API is available and keyboard might be visible
    if (!visualViewport) return;

    try {
      // Get textarea position and caret info
      const textareaRect = textarea.getBoundingClientRect();
      const caretPosition = textarea.selectionStart;

      // Simple approximation: assume caret is at scroll position + some offset
      // This is much lighter than creating mirror elements
      const lineHeight =
        parseFloat(window.getComputedStyle(textarea).lineHeight) || 56; // 3.5rem default
      const textBeforeCaret = textarea.value.substring(0, caretPosition);
      const lineCount = textBeforeCaret.split("\n").length;
      const approximateCaretTop =
        textareaRect.top + (lineCount - 1) * lineHeight;
      const approximateCaretBottom = approximateCaretTop + lineHeight;

      // Check if caret is below visible area (with buffer)
      const threshold = 40; // Larger buffer for approximation
      const visualBottom = visualViewport.height + visualViewport.offsetTop;

      if (approximateCaretBottom > visualBottom - threshold) {
        // Scroll to end of textarea with smooth behavior
        textarea.scrollTop = textarea.scrollHeight;

        if (process.env.NODE_ENV !== "production") {
          console.log("📱 Auto-scrolled textarea for caret visibility:", {
            approximateCaretBottom,
            visualBottom,
            threshold,
          });
        }
      }
    } catch (error) {
      // Silently fail if measurement doesn't work
      if (process.env.NODE_ENV !== "production") {
        console.warn("📱 Caret visibility check failed:", error);
      }
    }
  }, []);

  // Attach caret visibility handlers
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInputEvent = () => {
      // Small delay to ensure DOM updates are complete
      setTimeout(ensureCaretVisible, 50);
    };

    const handleSelectionChange = () => {
      // Only handle if this textarea is focused
      if (document.activeElement === textarea) {
        setTimeout(ensureCaretVisible, 50);
      }
    };

    textarea.addEventListener("input", handleInputEvent);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      textarea.removeEventListener("input", handleInputEvent);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [ensureCaretVisible]);

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
          <div className="relative flex-1 min-h-0 keyboard-safe-bottom">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder={placeholder}
              className={cn(
                `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex relative z-10`,
                "py-6 h-full scrollbar-thin scroll-keyboard-safe scrollable"
              )}
              style={{
                caretColor: "currentColor",
                overflowY: "auto",
                overflowX: "hidden",
                resize: "none",
                lineHeight: "3.5rem",
                fontSize: "1rem",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                paddingTop: `${24 + (extraTopPaddingPx || 0)}px`,
                transition: "padding-top 400ms ease-out", // CSS ease-out for consistency
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

            {/* Inline overlay slot (e.g., highlights), positioned within container */}
            {children}

            {/* Top gradient overlay for smooth transition from timer */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />

            {/* Chip Overlay - positioned relative to textarea container */}
            <ChipOverlay
              visibleProds={prods}
              sentencePositions={sentencePositions}
              sentences={sentences}
              textareaRef={textareaRef}
              extraTopPaddingPx={extraTopPaddingPx}
              onChipKeep={(prod) => pinProd(prod.id)}
              onChipFade={(id) => removeProd(id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
