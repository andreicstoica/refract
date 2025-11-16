"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/helpers";
import { Play, Pause } from "lucide-react";

interface WritingTimerProps {
  initialMinutes: number;
  onTimerComplete?: () => void;
  className?: string;
  onThreshold?: (secondsLeft: number) => void;
  thresholdSeconds?: number;
}

export function WritingTimer({
  initialMinutes,
  onTimerComplete,
  className,
  onThreshold,
  thresholdSeconds = 20,
}: WritingTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredComplete = useRef(false);
  const hasFiredThreshold = useRef(false);

  // Start timer immediately when component mounts
  useEffect(() => {
    setIsRunning(true);
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
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Handle timer completion separately to avoid setState during render
  useEffect(() => {
    if (timeLeft <= 0 && !hasTriggeredComplete.current) {
      hasTriggeredComplete.current = true;
      setTimeout(() => {
        onTimerComplete?.();
      }, 0);
    }
  }, [timeLeft, onTimerComplete]);

  // Fire threshold callback once when timeLeft crosses or equals threshold
  useEffect(() => {
    if (
      typeof thresholdSeconds === "number" &&
      !hasFiredThreshold.current &&
      timeLeft <= thresholdSeconds &&
      onThreshold
    ) {
      hasFiredThreshold.current = true;
      // Defer to avoid calling during render cycle
      setTimeout(() => onThreshold(timeLeft), 0);
    }
  }, [timeLeft, thresholdSeconds, onThreshold]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds <= 0) {
      // Show overtime: +0:01, +0:02, etc.
      const overtimeSeconds = Math.abs(seconds);
      const mins = Math.floor(overtimeSeconds / 60);
      const secs = overtimeSeconds % 60;
      return `+${mins}:${secs.toString().padStart(2, "0")}`;
    }
    // Show countdown: 1:00, 0:59, etc.
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: "easeOut", // Framer Motion's built-in easeOut
      }}
      className={cn(
        "group relative flex items-center justify-center gap-3 px-3 h-10",
        // Neutral styling consistent with other components
        "bg-muted/50 backdrop-blur-sm border border-border/50 rounded-md",
        "font-medium cursor-pointer",
        className
      )}
      onClick={isRunning ? pauseTimer : resumeTimer}
    >
      {/* Timer Display */}
      <div
        className={cn(
          "flex items-center gap-2 transition-all duration-200",
          // Blur when paused; only blur on hover for pointer/desktop (md+)
          !isRunning ? "blur-sm" : "md:group-hover:blur-sm"
        )}
      >
        <div
          className={cn(
            "text-base sm:text-lg font-mono tabular-nums transition-colors duration-200",
            // Mute text when paused; only on hover for pointer/desktop (md+)
            !isRunning
              ? "text-muted-foreground"
              : "md:group-hover:text-muted-foreground"
          )}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Hover/Paused Overlay with Pause Button */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-200",
          // On mobile, don't show hover state when running; desktop shows on hover
          isRunning
            ? "opacity-0 md:group-hover:opacity-100 pointer-events-none"
            : "opacity-100 pointer-events-none"
        )}
      >
        {isRunning ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </div>
    </motion.div>
  );
}
