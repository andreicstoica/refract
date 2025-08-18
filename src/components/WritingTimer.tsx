"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/utils";
import { Play, Pause, SkipForward } from "lucide-react";

interface WritingTimerProps {
  initialMinutes: number;
  onTimerComplete: () => void;
  onFastForward: () => void;
  onDone: () => void;
  isProcessing?: boolean;
  className?: string;
}

export function WritingTimer({
  initialMinutes,
  onTimerComplete,
  onFastForward,
  onDone,
  isProcessing = false,
  className,
}: WritingTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(true);
  const [showFastForward, setShowFastForward] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef<"down" | "up">("down");
  const initialTimeRef = useRef(initialMinutes * 60); // Store initial time to prevent reset

  // Start timer when component mounts
  useEffect(() => {
    setHasStarted(true);
    setIsRunning(true);
  }, []);

  // Show fastforward option after 20 seconds
  useEffect(() => {
    const fastForwardTimer = setTimeout(() => {
      setShowFastForward(true);
    }, 20000);

    return () => clearTimeout(fastForwardTimer);
  }, []);

  // Drive ticking using effect to avoid stale closures
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        // Switch mode once when reaching zero
        if (modeRef.current === "down") {
          if (prev <= 1) {
            modeRef.current = "up";
            if (!isCompleted) {
              setIsCompleted(true);
              onTimerComplete();
            }
            return 0;
          }
          return prev - 1;
        }

        // Count up
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isCompleted, onTimerComplete]);

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const resumeTimer = () => {
    setIsRunning(true);
  };

  const handleFastForward = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    modeRef.current = "up";
    setIsCompleted(true);
    onFastForward();
    // Keep running so it starts counting up from current time
    setIsRunning(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeString = `${mins}:${secs.toString().padStart(2, "0")}`;
    return isCompleted ? `+${timeString}` : timeString;
  };

  const progressPercentage = isCompleted
    ? 100 // Show full progress when completed
    : ((initialTimeRef.current - timeLeft) / initialTimeRef.current) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "flex items-center justify-center gap-4 p-4",
        "bg-background/80 backdrop-blur-sm border border-blue-200/30 rounded-full",
        "text-blue-700 dark:text-blue-300 font-medium",
        className
      )}
    >
      {/* Timer Display - hidden when completed */}
      {!isCompleted && (
        <>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-mono tabular-nums">
              {formatTime(timeLeft)}
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={isRunning ? pauseTimer : resumeTimer}
              className="p-1 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
            >
              {isRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-24 h-1 bg-blue-200/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </>
      )}

      {/* Right-side CTA: Skip → Done */}
      <AnimatePresence>
        {!isCompleted && showFastForward && (
          <motion.button
            key="skip"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleFastForward}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-full transition-colors"
          >
            <SkipForward className="w-3 h-3" />
            Skip
          </motion.button>
        )}

        {isCompleted && (
          <motion.button
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={onDone}
            disabled={isProcessing}
            className={cn(
              "px-3 py-1 text-sm rounded-full transition-colors",
              "border border-blue-400/30 bg-blue-500/10",
              "text-blue-700 dark:text-blue-300",
              isProcessing
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-blue-500/20"
            )}
          >
            {isProcessing ? "Analyzing…" : "Done"}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
