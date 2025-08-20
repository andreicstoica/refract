"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/utils";
import { Clock, Play, ChevronUp, ChevronDown } from "lucide-react";

interface TimerSetupModalProps {
  isOpen: boolean;
  onStart: (minutes: number) => void;
  className?: string;
}

export function TimerSetupModal({
  isOpen,
  onStart,
  className,
}: TimerSetupModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(1);
  const [inputBuffer, setInputBuffer] = useState("");
  const bufferResetRef = useRef<number | null>(null);
  const minutesRef = useRef(selectedMinutes);

  useEffect(() => {
    minutesRef.current = selectedMinutes;
  }, [selectedMinutes]);

  const handleIncrement = () => {
    setSelectedMinutes((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setSelectedMinutes((prev) => Math.max(1, prev - 1));
  };

  const handleStart = () => {
    onStart(selectedMinutes);
  };

  // Keyboard handling when the modal is open
  useEffect(() => {
    if (!isOpen) return;

    const resetBufferSoon = () => {
      if (bufferResetRef.current) {
        window.clearTimeout(bufferResetRef.current);
      }
      bufferResetRef.current = window.setTimeout(() => {
        setInputBuffer("");
        bufferResetRef.current = null;
      }, 1000);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Intercept only the keys we care about
      const { key } = event;

      // Arrow handling
      if (key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedMinutes((prev) => prev + 1);
        return;
      }
      if (key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedMinutes((prev) => Math.max(1, prev - 1));
        return;
      }

      // Enter starts writing
      if (key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        onStart(minutesRef.current);
        return;
      }

      // Numeric entry to set minutes (supports multi-digit)
      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        event.stopPropagation();
        setInputBuffer((prev) => {
          const next = (prev + key).replace(/^0+(\d)/, "$1");
          const parsed = parseInt(next, 10);
          setSelectedMinutes(Number.isNaN(parsed) ? 1 : Math.max(1, parsed));
          return next;
        });
        resetBufferSoon();
        return;
      }

      // Allow correcting numeric input with Backspace
      if (key === "Backspace") {
        if (inputBuffer.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          setInputBuffer((prev) => {
            const next = prev.slice(0, -1);
            const parsed = parseInt(next || "0", 10);
            setSelectedMinutes(Math.max(1, parsed || 1));
            return next;
          });
          resetBufferSoon();
        }
        return;
      }
    };

    // Use capture to intercept before underlying textarea
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (bufferResetRef.current) {
        window.clearTimeout(bufferResetRef.current);
        bufferResetRef.current = null;
      }
    };
  }, [isOpen, inputBuffer, onStart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 max-w-sm w-full",
              "shadow-xl backdrop-blur-sm",
              className
            )}
            role="dialog"
            aria-modal="true"
          >
            <div className="text-center space-y-8">
              {/* Header */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="text-gray-600 dark:text-gray-400 text-md">
                  How long would you like to write?
                </div>
                {/* Info */}
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  You can pause, resume, or skip the timer at any time
                </p>
              </div>

              {/* Clock Display */}
              <div className="flex items-center justify-center gap-6">
                {/* Minutes */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleIncrement}
                    className="p-2 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                  >
                    <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </button>

                  <div className="text-4xl font-mono tabular-nums text-blue-700 dark:text-blue-300">
                    {selectedMinutes.toString().padStart(2, "0")}
                  </div>

                  <button
                    onClick={handleDecrement}
                    disabled={selectedMinutes <= 1}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      selectedMinutes <= 1
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                    )}
                  >
                    <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </button>

                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {selectedMinutes === 1 ? "minute" : "minutes"}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Writing
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
