"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/helpers";
import { Play, Pause } from "lucide-react";

interface WritingTimerProps {
  initialMinutes: number;
  onTimerComplete: () => void;
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

  // Keep the callback ref updated
  useEffect(() => {
    onTimerCompleteRef.current = onTimerComplete;
  }, [onTimerComplete]);

  const onTimerCompleteRef = useRef(onTimerComplete);
  const onThresholdRef = useRef(onThreshold);

  useEffect(() => {
    onThresholdRef.current = onThreshold;
  }, [onThreshold]);

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
        onTimerCompleteRef.current();
      }, 0);
    }
  }, [timeLeft]);

  // Fire threshold callback once when timeLeft crosses or equals threshold
  useEffect(() => {
    if (
      typeof thresholdSeconds === "number" &&
      !hasFiredThreshold.current &&
      timeLeft <= thresholdSeconds
    ) {
      hasFiredThreshold.current = true;
      // Defer to avoid calling during render cycle
      const cb = onThresholdRef.current;
      if (cb) setTimeout(() => cb(timeLeft), 0);
    }
  }, [timeLeft, thresholdSeconds]);

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
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "flex items-center justify-center gap-3 px-3 py-1.5",
        // Neutral styling consistent with other components
        "bg-muted/50 backdrop-blur-sm border border-border/50 rounded-md shadow-sm",
        "text-foreground/90 font-medium",
        className
      )}
    >
      {/* Timer Display */}
      <div className="flex items-center gap-2">
        <div className="text-base sm:text-lg font-mono tabular-nums">
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Play/Pause Button */}
      <button
        onClick={isRunning ? pauseTimer : resumeTimer}
        className="p-1.5 hover:bg-muted/70 rounded-sm transition-colors"
      >
        {isRunning ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
    </motion.div>
  );
}
