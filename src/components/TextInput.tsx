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

interface TextInputProps {
  onTextChange?: (text: string) => void;
  placeholder?: string;
}

export function TextInput({
  onTextChange,
  placeholder = "What's on your mind?",
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
  const { prods, callProdAPI } = useProds();

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
      // Scroll to the bottom to keep cursor in view
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

    // Debounced position update to avoid measuring during active typing
    if (positionTimerRef.current) {
      clearTimeout(positionTimerRef.current);
    }

    positionTimerRef.current = setTimeout(() => {
      if (textareaRef.current && newSentences.length > 0) {
        const positions = measurePositions(newSentences, textareaRef.current);
        setSentencePositions(positions);
      }
    }, 100); // Short delay to avoid measuring while actively typing

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check for punctuation trigger (sentence ending)
    const hasPunctuation = /[.!?;:]\s*$/.test(newText.trim());

    if (hasPunctuation && newSentences.length > 0) {
      console.log("⚙️ Punctuation trigger detected");
      const lastSentence = newSentences[newSentences.length - 1];
      callProdAPI(lastSentence);
    } else {
      // Set 3-second debounce timer
      console.log("⏳ Setting 3s debounce timer");
      debounceTimerRef.current = setTimeout(() => {
        // Use current sentences state instead of closure variable
        const currentSentences = splitIntoSentences(textareaRef.current?.value || "");
        if (currentSentences.length > 0) {
          const lastSentence = currentSentences[currentSentences.length - 1];
          callProdAPI(lastSentence);
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

  // Determine if we should use full height or centered layout
  const hasContent = text.trim().length > 0;
  const textLength = text.length;
  const lineCount = text.split('\n').length;
  
  // Switch to full height when text would exceed the initial box
  // Check both character count and line count for better detection
  let shouldUseFullHeight = hasContent && (textLength > 400 || lineCount > 10);

  return (
    <div className={cn(
      "h-dvh bg-background text-foreground relative",
      shouldUseFullHeight ? "overflow-hidden" : "overflow-hidden"
    )}>
      {/* TODO - Temporary debug info - moved to bottom */}
      <div className="absolute bottom-2 right-2 z-50 text-xs opacity-70 bg-background/80 p-2 rounded max-w-xs">
        <div>📏 Text length: {text.length}</div>
        <div>🤖 AI Status:</div>
        <div className="ml-2">prodsCount: {prods.length}, isLoading: false</div>
        <div>💡 Current prods:</div>
        <div className="ml-2 text-red-400">
          ({prods.length}) {JSON.stringify(prods.map((p) => p.text))}
        </div>
      </div>
      {/* Fade overlay for top - always visible for subtle effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: shouldUseFullHeight ? 1 : 0.6 }}
        transition={{ duration: 0.2 }}
        className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background from-40% via-background/60 via-70% to-transparent z-10 pointer-events-none"
      />

      <motion.div
        className="mx-auto max-w-2xl px-4 w-full"
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
          className="relative h-full"
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder={placeholder}
            className={cn(
              "w-full bg-transparent text-lg leading-relaxed outline-none border-none placeholder:text-muted-foreground/40 resize-none box-border px-4",
              shouldUseFullHeight ? "py-6 pb-24" : "py-4"
            )}
            style={{
              fontFamily: "inherit",
              caretColor: "currentColor",
              height: shouldUseFullHeight ? "100%" : "calc(100vh - 8rem)",
              transition: "height 0.3s ease-out",
              overflow: shouldUseFullHeight ? "auto" : "hidden", // Control scrolling behavior
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </motion.div>
      </motion.div>

      {/* Chip Overlay */}
      <ChipOverlay prods={prods} sentencePositions={sentencePositions} />
    </div>
  );
}
