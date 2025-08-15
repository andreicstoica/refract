"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextInputProps {
  onTextChange?: (text: string) => void;
  placeholder?: string;
}

export function TextInput({
  onTextChange,
  placeholder = "What's on your mind?",
}: TextInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTextChange?.(newText);
  };

  // Determine if we should use full height or centered layout
  const hasContent = text.trim().length > 0;
  const textLength = text.length;
  // Switch to full height when text would exceed the initial box (based on content length or lines)
  let shouldUseFullHeight = hasContent && textLength > 400;

  return (
    <div className="h-dvh bg-background text-foreground overflow-hidden relative">
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
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
