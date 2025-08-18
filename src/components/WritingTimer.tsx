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
  const [showSkip, setShowSkip] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialTimeRef = useRef(initialMinutes * 60);
  const hasCompletedRef = useRef(false); // Track completion to prevent multiple calls

  // Start timer immediately when component mounts
  useEffect(() => {
    setIsRunning(true);

    // Show skip button after 20 seconds
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 20000);

    return () => clearTimeout(skipTimer);
  }, []);

  // Simple timer logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer reached zero, start counting up
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true;
            setIsCompleted(true);
            onTimerComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, onTimerComplete]); // Removed isCompleted from dependencies

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

  const handleSkip = () => {
    if (isCompleted) {
      onDone();
    } else {
      onFastForward();
    }
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
      {/* Timer Display */}
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

      {/* Skip/Done Button */}
      <AnimatePresence>
        {showSkip && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleSkip}
            disabled={isProcessing}
            className={cn(
              "flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors",
              isCompleted
                ? "border border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : "bg-blue-500/20 hover:bg-blue-500/30",
              isProcessing
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-blue-500/20"
            )}
          >
            {isCompleted ? (
              isProcessing ? (
                "Analyzing…"
              ) : (
                "Done"
              )
            ) : (
              <>
                <SkipForward className="w-3 h-3" />
                Skip
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
