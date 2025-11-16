"use client";

import React, { useEffect, useCallback } from "react";
import { cn } from "@/lib/helpers";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";
import { useTopicShiftDetection } from "@/features/writing/hooks/useTopicShiftDetection";
import { useEditorText } from "@/features/writing/hooks/useEditorText";
import { useSentenceTracker } from "@/features/writing/hooks/useSentenceTracker";
import { useProdTriggers } from "@/features/writing/hooks/useProdTriggers";
import { useTimingConfig } from "@/features/config/TimingConfigProvider";
import { useProdActions } from "@/features/prods/context/ProdsProvider";
import { debug } from "@/lib/debug";
import { ChipOverlay } from "./ChipOverlay";
import { TEXTAREA_CLASSES, TEXT_DISPLAY_STYLES } from "@/lib/layoutConstants";

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
  const { config } = useTimingConfig();
  const { enqueueSentence, notifyTopicShift, updateTopicContext } =
    useProdActions();

  const editor = useEditorText({
    onTextChange: (newText) => {
      onTextChange?.(newText);
    },
  });

  const { textareaRef } = editor;

  // Topic shift detection (needs to be first to get keywords for prod system)
  const { hasTopicShift, currentKeywords, topicVersion } =
    useTopicShiftDetection({
      text: editor.text,
      onTopicShift: () => {
        debug.dev("🌟 Topic shift detected in TextInput");
      },
    });

  useEffect(() => {
    updateTopicContext({
      keywords: currentKeywords,
      version: topicVersion,
    });
  }, [currentKeywords, topicVersion, updateTopicContext]);

  const tracker = useSentenceTracker({
    text: editor.text,
    textareaRef: editor.textareaRef,
    onUpdate: (textValue, sentencesList, positions) => {
      onTextUpdate?.(textValue, sentencesList, positions);
    },
  });

  const handleProdTrigger = useCallback(
    (fullText: string, sentence: Sentence, opts?: { force?: boolean }) => {
      enqueueSentence({
        fullText,
        sentence,
        force: opts?.force,
      });
    },
    [enqueueSentence]
  );

  useProdTriggers({
    text: editor.text,
    sentences: tracker.sentences,
    onTrigger: handleProdTrigger,
    config,
    prodsEnabled,
  });

  // Expose textarea ref to parent once and on handler change
  useEffect(() => {
    onTextareaRef?.(editor.textareaRef.current);
    return () => {
      onTextareaRef?.(null);
    };
  }, [onTextareaRef, editor.textareaRef]);

  // Lock page-level scroll so the textarea owns the only scrollbar.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyHeight = body.style.height;
    const prevHtmlHeight = documentElement.style.height;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.height = "100%";
    documentElement.style.height = "100%";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.height = prevBodyHeight;
      documentElement.style.height = prevHtmlHeight;
    };
  }, []);

  // Simplified caret auto-scroll functionality for keyboard visibility
  const ensureCaretVisible = useCallback(() => {
    if (!editor.textareaRef.current) return;

    const textarea = editor.textareaRef.current;
    const visualViewport = window.visualViewport;

    // Only proceed if Visual Viewport API is available and keyboard might be visible
    if (!visualViewport) return;

    try {
      // Get textarea position and caret info
      const textareaRect = textarea.getBoundingClientRect();
      const caretPosition = textarea.selectionStart;

      // Simple approximation: assume caret is at scroll position + some offset
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

        debug.dev("📱 Auto-scrolled textarea for caret visibility:", {
          approximateCaretBottom,
          visualBottom,
          threshold,
        });
      }
    } catch (error) {
      // Silently fail if measurement doesn't work
      debug.dev("📱 Caret visibility check failed:", error);
    }
  }, [editor.textareaRef]);

  // Attach caret visibility handlers
  useEffect(() => {
    const textarea = editor.textareaRef.current;
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
  }, [ensureCaretVisible, editor.textareaRef]);

  // Connect topic shift to prod cancellation (avoid calling during render)
  useEffect(() => {
    if (hasTopicShift) {
      debug.dev("🎯 Topic shift handled by prod system");
      notifyTopicShift();
    }
  }, [hasTopicShift, notifyTopicShift]);

  return (
    <div className="relative h-full w-full">
      {/* Static centered container */}
      <div className="mx-auto max-w-2xl w-full h-full px-4">
        <div className={cn("h-full overflow-hidden flex flex-col min-h-0")}>
          {/* Scrollable writing area fills remaining height */}
          <div className="relative flex-1 min-h-0 keyboard-safe-bottom">
            <textarea
              ref={editor.textareaRef}
              value={editor.text}
              onChange={editor.handleChange}
              placeholder={placeholder}
              className={cn(
                `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING} font-plex relative z-10`,
                "py-6 h-full scrollbar-thin scroll-keyboard-safe scrollable scroll-no-bounce"
              )}
              style={{
                caretColor: "currentColor",
                overflowY: "auto",
                overflowX: "hidden",
                resize: "none",
                ...TEXT_DISPLAY_STYLES.INLINE_STYLES,
                paddingTop: `${24 + (extraTopPaddingPx || 0)}px`,
                transition: "padding-top 400ms ease-out",
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              onWheelCapture={(e) => e.stopPropagation()}
              onPaste={(e) => {
                // Prevent the page from auto-scrolling when pasting (stop event bubbling)
                e.stopPropagation();
                // Let paste complete, then ensure caret is visible smoothly
                // Double RAF ensures paste DOM updates complete before scroll check
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    ensureCaretVisible(); // Handles mobile keyboard visibility
                    if (editor.textareaRef.current) {
                      editor.textareaRef.current.focus();
                    }
                  });
                });
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
              sentencePositions={tracker.positions}
              sentences={tracker.sentences}
              textareaRef={editor.textareaRef}
              extraTopPaddingPx={extraTopPaddingPx}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
