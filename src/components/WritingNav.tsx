"use client";

import { useState } from "react";
import { WritingTimer } from "./WritingTimer";
import { TimerSetupModal } from "./TimerSetupModal";

interface WritingNavProps {
  onDone: () => void;
  isProcessing?: boolean;
}

export function WritingNav({ onDone, isProcessing = false }: WritingNavProps) {
  // Timer state
  const [showTimerSetup, setShowTimerSetup] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerCompleted, setTimerCompleted] = useState(false);

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

  return (
    <>
      {/* Timer Setup Modal */}
      <TimerSetupModal isOpen={showTimerSetup} onStart={handleTimerStart} />

      {/* Timer Display */}
      {!showTimerSetup && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
          <WritingTimer
            initialMinutes={timerMinutes}
            onTimerComplete={handleTimerComplete}
            onFastForward={handleFastForward}
            onDone={onDone}
            isProcessing={isProcessing}
          />
        </div>
      )}
    </>
  );
}
