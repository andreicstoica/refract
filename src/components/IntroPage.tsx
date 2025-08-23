"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/helpers";

interface IntroPageProps {
  onNext: () => void;
  isEnterPressed: boolean;
}

export function IntroPage({ onNext, isEnterPressed }: IntroPageProps) {
  return (
    <>
      {/* Intro Page */}
      <div className="flex flex-col items-center justify-center gap-6">
        <h1 className="text-2xl font-semibold text-foreground">Welcome</h1>
        <div className="space-y-4 text-muted-foreground text-sm">
          <p>
            Journal about whatever's on your mind. We don't store your writing.
          </p>
          <p>
            Our AI will gently nudge you deeper and surface connections you
            might have missed.
          </p>
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        className={cn(
          "group w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-all duration-150",
          isEnterPressed && "bg-primary/80 scale-95 shadow-inner"
        )}
      >
        Get Started
        <ChevronRight
          className={cn(
            "w-4 h-4 transition-transform group-hover:translate-x-0.5",
            isEnterPressed && "translate-x-0.5"
          )}
        />
      </button>
    </>
  );
}
