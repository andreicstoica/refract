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
import { DoneButton } from "./DoneButton";
import { WritingTimer } from "./WritingTimer";
import { TimerSetupModal } from "./TimerSetupModal";
import { TEXTAREA_CLASSES } from "@/lib/constants";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  // Use our custom hook for prod management
  const { prods, callProdAPI, clearQueue, queueState, filteredSentences } =
    useProds();

  // Embeddings state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  // Timer state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerCompleted, setTimerCompleted] = useState(false);

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
        console.log("📍 Position measurement:", {
          sentencesCount: newSentences.length,
          positionsCount: positions.length,
          sentences: newSentences.map((s) => ({ id: s.id, text: s.text })),
          positions: positions.map((p) => ({
            sentenceId: p.sentenceId,
            top: p.top,
            left: p.left,
          })),
        });
        setSentencePositions(positions);
      }
    }, 50); // Reduced delay for better responsiveness

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
        // Use current sentences state instead of closure variable
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

  // Handle embeddings generation when user clicks "Done"
  const handleGenerateEmbeddings = useCallback(async () => {
    if (filteredSentences.length === 0) {
      console.log("⚠️ No filtered sentences available for embeddings");
      return;
    }

    setIsGeneratingEmbeddings(true);

    try {
      console.log(
        `🎯 Generating embeddings for ${filteredSentences.length} cached sentences`
      );

      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences: filteredSentences,
          fullText: text,
        }),
      });

      if (!response.ok) throw new Error("Embeddings API call failed");

      const data = await response.json();
      console.log("✨ Embeddings result:", data);

      // Save to localStorage for themes page
      localStorage.setItem("refract-themes", JSON.stringify(data.themes || []));
      localStorage.setItem("refract-text", text);

      // Navigate to themes page
      router.push("/themes");
    } catch (error) {
      console.error("❌ Embeddings generation failed:", error);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  }, [filteredSentences, text, router]);

  // Timer handlers
  const handleTimerStart = (minutes: number) => {
    setTimerMinutes(minutes);
    setShowTimerSetup(false);
  };

  const handleTimerComplete = () => {
    setTimerCompleted(true);
  };

  const handleFastForward = () => {
    setTimerCompleted(true);
  };

  // Determine if we should use full height or centered layout
  const hasContent = text.trim().length > 0;
  const lineCount = text.split("\n").length;

  // Switch to full height when text would exceed the initial box
  // Check both character count and line count for better detection
  let shouldUseFullHeight = hasContent && (text.length > 400 || lineCount > 10);

  // Update positions immediately when layout changes
  useEffect(() => {
    if (textareaRef.current && sentences.length > 0) {
      const positions = measurePositions(sentences, textareaRef.current);
      setSentencePositions(positions);
    }
  }, [shouldUseFullHeight, sentences, measurePositions]);

  return (
    <div
      className={cn(
        "h-dvh bg-background text-foreground relative overflow-hidden"
      )}
    >
      {/* Timer Setup Modal */}
      <TimerSetupModal isOpen={showTimerSetup} onStart={handleTimerStart} />

      {/* Timer Display */}
      {!showTimerSetup && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
          <WritingTimer
            initialMinutes={timerMinutes}
            onTimerComplete={handleTimerComplete}
            onFastForward={handleFastForward}
            onDone={handleGenerateEmbeddings}
            isProcessing={isGeneratingEmbeddings}
          />
        </div>
      )}
      {/* Temporary debug info - moved to bottom */}
      <div className="absolute bottom-2 right-2 z-50 text-xs opacity-70 bg-background/80 p-2 rounded max-w-xs">
        <div>📏 Text length: {text.length}</div>
        <div>⏱️ Timer completed: {timerCompleted ? "yes" : "no"}</div>
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
        <div className="ml-2 text-red-400">
          ({prods.length}) {JSON.stringify(prods.map((p) => p.text))}
        </div>
        <div>📍 Sentence positions: {sentencePositions.length}</div>
        <div className="ml-2 text-green-400">
          {sentencePositions
            .map((pos) => `${pos.sentenceId}: ${pos.top},${pos.left}`)
            .join(", ")}
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
          top: shouldUseFullHeight ? "80px" : "auto", // Account for timer height
          left: shouldUseFullHeight ? "50%" : "auto",
          transform: shouldUseFullHeight ? "translateX(-50%)" : "none",
          height: shouldUseFullHeight ? "calc(100vh - 80px)" : "auto", // Subtract timer height
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
              overflow: "auto", // Always allow scrolling when needed
              resize: "none", // Prevent manual resizing
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
