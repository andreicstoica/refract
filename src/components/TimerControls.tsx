"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/helpers";

interface TimerControlsProps {
  selectedMinutes: number;
  onMinutesChange: (minutes: number) => void;
  onStart: () => void;
  isEnterPressed: boolean;
  numberDirection?: "up" | "down" | null;
  arrowPressed?: "up" | "down" | null;
  onNumberDirectionChange?: (direction: "up" | "down" | null) => void;
  onArrowPressedChange?: (pressed: "up" | "down" | null) => void;
}

export function TimerControls({
  selectedMinutes,
  onMinutesChange,
  onStart,
  isEnterPressed,
  numberDirection: externalNumberDirection,
  arrowPressed: externalArrowPressed,
  onNumberDirectionChange,
  onArrowPressedChange,
}: TimerControlsProps) {
  const [internalNumberDirection, setInternalNumberDirection] = useState<
    "up" | "down" | null
  >(null);
  const [internalArrowPressed, setInternalArrowPressed] = useState<
    "up" | "down" | null
  >(null);

  // Use external state if provided, otherwise use internal state
  const numberDirection = externalNumberDirection ?? internalNumberDirection;
  const arrowPressed = externalArrowPressed ?? internalArrowPressed;

  const setNumberDirection = (direction: "up" | "down" | null) => {
    if (onNumberDirectionChange) {
      onNumberDirectionChange(direction);
    } else {
      setInternalNumberDirection(direction);
    }
  };

  const setArrowPressed = (pressed: "up" | "down" | null) => {
    if (onArrowPressedChange) {
      onArrowPressedChange(pressed);
    } else {
      setInternalArrowPressed(pressed);
    }
  };

  const handleIncrement = () => {
    setNumberDirection("up");
    setArrowPressed("up");
    onMinutesChange(selectedMinutes + 1);
    setTimeout(() => {
      setNumberDirection(null);
      setArrowPressed(null);
    }, 200);
  };

  const handleDecrement = () => {
    setNumberDirection("down");
    setArrowPressed("down");
    onMinutesChange(Math.max(1, selectedMinutes - 1));
    setTimeout(() => {
      setNumberDirection(null);
      setArrowPressed(null);
    }, 200);
  };

  return (
    <div className="space-y-8">
      {/* Timer Setup Page */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="text-muted-foreground text-md">
          How long would you like to write?
        </div>
        <p className="text-xs text-muted-foreground">
          You can pause at any time. You can analyze your writing at the end of
          your session.
        </p>
      </div>

      {/* Clock Display */}
      <div className="flex items-center justify-center gap-6">
        {/* Minutes */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleIncrement}
            className={cn(
              "p-2 hover:bg-muted/70 rounded-full transition-all duration-200 ease-out",
              arrowPressed === "up"
                ? "scale-95 bg-muted/70"
                : "hover:scale-105 active:scale-95"
            )}
          >
            <ChevronUp className="w-5 h-5 text-foreground transition-transform duration-200 ease-out" />
          </button>

          <div
            className={cn(
              "text-4xl font-mono tabular-nums text-foreground transition-transform duration-200 ease-out",
              numberDirection === "up" && "transform -translate-y-1",
              numberDirection === "down" && "transform translate-y-1"
            )}
          >
            {selectedMinutes.toString().padStart(2, "0")}
          </div>

          <button
            onClick={handleDecrement}
            disabled={selectedMinutes <= 1}
            className={cn(
              "p-2 rounded-full transition-all duration-200 ease-out",
              selectedMinutes <= 1
                ? "opacity-30 cursor-not-allowed"
                : arrowPressed === "down"
                ? "scale-95 bg-muted/70"
                : "hover:bg-muted/70 hover:scale-105 active:scale-95"
            )}
          >
            <ChevronDown className="w-5 h-5 text-foreground transition-transform duration-200 ease-out" />
          </button>

          <div className="text-xs text-muted-foreground">
            {selectedMinutes === 1 ? "minute" : "minutes"}
          </div>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        className={cn(
          "group w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-all duration-150",
          isEnterPressed && "bg-primary/80 scale-95 shadow-inner"
        )}
      >
        Start Writing
        <CornerDownLeft
          className={cn(
            "w-4 h-4 transition-transform group-hover:translate-y-0.5",
            isEnterPressed && "translate-y-0.5"
          )}
        />
      </button>
    </div>
  );
}
