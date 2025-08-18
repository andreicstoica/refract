"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { splitIntoSentences } from "@/lib/sentenceUtils";
import type { Sentence } from "@/lib/sentenceUtils";
import { measureSentencePositions } from "@/lib/positionUtils";
import type { SentencePosition } from "@/lib/positionUtils";
import { useProds } from "@/lib/useProds";
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
  const [text, setText] = useState("");
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [sentencePositions, setSentencePositions] = useState<
    SentencePosition[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const positionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use our custom hook for prod management
  const { prods, callProdAPI, clearQueue, queueState, filteredSentences } =
    useProds();

  // Position measurement with memoization
  const measurePositions = useCallback(
    (sentences: Sentence[], textarea: HTMLTextAreaElement) => {
      return measureSentencePositions(
        sentences,
        textarea
      ) as SentencePosition[];
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
      callProdAPI(newText, lastSentence);
    } else {
      // Set 3-second debounce timer
      console.log("⏳ Setting 3s debounce timer");
      debounceTimerRef.current = setTimeout(() => {
        const currentText = textareaRef.current?.value || "";
        const currentSentences = splitIntoSentences(currentText);
        if (currentSentences.length > 0) {
          const lastSentence = currentSentences[currentSentences.length - 1];
          callProdAPI(currentText, lastSentence);
        }
      }, 3000);
    }
  };

  // Handle scroll and resize events to reposition chips
  useEffect(() => {
    const handleReposition = () => {
      if (textareaRef.current && sentences.length > 0 && prods.length > 0) {
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
  }, [sentences, prods, measurePositions]);

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

  // Determine if we should use full height or centered layout
  const hasContent = text.trim().length > 0;
  const lineCount = text.split("\n").length;
  let shouldUseFullHeight = hasContent && (text.length > 400 || lineCount > 10);

  return (
    <div className="h-full w-full">
      {/* Temporary debug info */}
      <div className="absolute bottom-2 right-2 z-50 text-xs opacity-70 bg-background/80 p-2 rounded max-w-xs">
        <div>📏 Text length: {text.length}</div>
        <div>💾 Cached sentences: {filteredSentences.length}</div>
        <div>🤖 AI Status:</div>
        <div className="ml-2">prodsCount: {prods.length}</div>
        <div className="ml-2">queueLength: {queueState.items.length}</div>
        <div className="ml-2">
          isProcessing: {queueState.isProcessing ? "yes" : "no"}
        </div>
        <div className="ml-2 text-blue-400">
          pending:{" "}
          {queueState.items.filter((i) => i.status === "pending").length},
          processing:{" "}
          {queueState.items.filter((i) => i.status === "processing").length}
        </div>
        <div className="ml-2">
          <button
            onClick={clearQueue}
            className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40"
          >
            Clear Queue
          </button>
        </div>
        <div>💡 Current prods:</div>
        <div className="ml-2 space-y-1">
          {prods.map((prod, index) => (
            <div
              key={prod.id}
              className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs mr-1 mb-1"
            >
              {prod.text}
            </div>
          ))}
        </div>
        <div>📍 Sentence positions: {sentencePositions.length}</div>
        <div className="ml-2 space-y-1">
          {sentencePositions.map((pos) => (
            <div
              key={pos.sentenceId}
              className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs mr-1 mb-1"
            >
              {pos.sentenceId}: {pos.top},{pos.left}
            </div>
          ))}
        </div>
      </div>

      <motion.div
        className="mx-auto max-w-2xl px-4 w-full h-full"
        animate={{
          position: shouldUseFullHeight ? "absolute" : "relative",
          top: shouldUseFullHeight ? "0" : "auto",
          left: shouldUseFullHeight ? "50%" : "auto",
          transform: shouldUseFullHeight ? "translateX(-50%)" : "none",
          height: shouldUseFullHeight ? "100vh" : "auto",
          marginTop: shouldUseFullHeight ? "0" : "20vh",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "relative",
            shouldUseFullHeight ? "h-full overflow-hidden" : ""
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder={placeholder}
            className={cn(
              `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING}`,
              shouldUseFullHeight ? "py-6" : "py-4"
            )}
            style={{
              fontFamily: "inherit",
              caretColor: "currentColor",
              height: shouldUseFullHeight ? "100%" : "calc(100vh - 8rem)",
              transition: "height 0.3s ease-out",
              overflow: "auto",
              resize: "none",
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />

          {/* Chip Overlay - positioned relative to textarea */}
          <ChipOverlay prods={prods} sentencePositions={sentencePositions} />
        </motion.div>
      </motion.div>
    </div>
  );
}
