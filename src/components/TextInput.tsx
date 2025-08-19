"use client";

import { motion } from "framer-motion";
import { cn } from "@/utils/utils";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";
import { useProds } from "@/hooks/useProds";
import { useTextProcessing } from "@/hooks/useTextProcessing";
import { ChipOverlay } from "./ChipOverlay";
import { TEXTAREA_CLASSES } from "@/utils/constants";
import { selectFirstProdPerSentence } from "@/utils/prodSelectors";
import { TextInputDebug } from "./debug/TextInputDebug";

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
  // Use our custom hook for prod management
  const { prods, callProdAPI, clearQueue, queueState, filteredSentences } =
    useProds();

  // Use text processing hook for all text-related logic
  const {
    text,
    sentences,
    sentencePositions,
    textareaRef,
    handleTextChange,
    layout,
  } = useTextProcessing({
    onProdTrigger: callProdAPI,
    onTextChange,
    onTextUpdate,
  });

  return (
    <div className="h-full w-full">
      {/* Debug HUD */}
      <TextInputDebug
        text={text}
        filteredSentences={filteredSentences}
        prods={prods}
        queueState={queueState}
        sentencePositions={sentencePositions}
        onClearQueue={clearQueue}
      />

      <motion.div
        className="mx-auto max-w-2xl px-4 w-full h-full"
        animate={{
          position: layout.shouldUseFullHeight ? "absolute" : "relative",
          top: layout.shouldUseFullHeight ? "0" : "auto",
          left: layout.shouldUseFullHeight ? "50%" : "auto",
          transform: layout.shouldUseFullHeight ? "translateX(-50%)" : "none",
          height: layout.shouldUseFullHeight ? "100vh" : "auto",
          marginTop: layout.shouldUseFullHeight ? "0" : "20vh",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "relative",
            layout.shouldUseFullHeight ? "h-full overflow-hidden" : ""
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder={placeholder}
            className={cn(
              `${TEXTAREA_CLASSES.BASE} ${TEXTAREA_CLASSES.TEXT} ${TEXTAREA_CLASSES.PADDING}`,
              layout.shouldUseFullHeight ? "py-6" : "py-4"
            )}
            style={{
              fontFamily: "inherit",
              caretColor: "currentColor",
              height: layout.shouldUseFullHeight
                ? "100%"
                : "calc(100vh - 8rem)",
              transition: "height 0.3s ease-out",
              overflow: "auto",
              resize: "none",
              lineHeight: "3.5rem",
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />

          {/* Chip Overlay - positioned relative to textarea */}
          <ChipOverlay
            visibleProds={selectFirstProdPerSentence(prods)}
            sentencePositions={sentencePositions}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
