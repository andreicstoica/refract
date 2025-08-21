"use client";

import { PencilLine, Binoculars } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AppNavProps {
  active: "write" | "reflect";
  onTabChange: (tab: "write" | "reflect") => void;
  analyzeDisabled?: boolean;
  isProcessing?: boolean;
  className?: string;
}

export function AppNav({
  active,
  onTabChange,
  analyzeDisabled = false,
  isProcessing = false,
  className,
}: AppNavProps) {
  const handleTabChange = (value: string) => {
    if (value === "write" || value === "reflect") {
      onTabChange(value);
    }
  };

  // Dynamic state detection
  const hasContent = !analyzeDisabled || isProcessing; // Expand when content available or processing
  const shouldExpand = hasContent; // Expand when content available
  const shouldDisable = analyzeDisabled; // Disable when no content OR processing

  // Accessible label for the Analyze tab based on state
  const analyzeAriaLabel = isProcessing
    ? "Analyze (processing)"
    : analyzeDisabled
    ? "Analyze (not ready)"
    : "Analyze";

  // Animation configuration
  const transition = {
    type: "spring" as const,
    bounce: 0.1,
    duration: 0.4,
  };

  return (
    <div
      className={cn(
        "w-full",
        "bg-background/80 backdrop-blur-sm border-b border-border/50",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-center max-w-2xl mx-auto">
        {/* Centered Tabs */}
        <Tabs value={active} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/80 shadow-inner border border-border/30">
            <TabsTrigger
              value="write"
              className="flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-background/95"
            >
              <PencilLine className="w-4 h-4" />
              Write
            </TabsTrigger>

            {/* Dynamic Analyze Button */}
            <motion.div
              animate={{ width: shouldExpand ? "120px" : "48px" }}
              transition={transition}
              className="overflow-hidden"
            >
              <TabsTrigger
                value="reflect"
                className="flex items-center gap-2 w-full justify-center data-[state=active]:shadow-sm data-[state=active]:bg-background/95"
                disabled={shouldDisable}
                aria-label={analyzeAriaLabel}
              >
                <Binoculars
                  className={cn(
                    "w-4 h-4 transition-colors",
                    shouldDisable ? "text-muted-foreground/50" : "text-current"
                  )}
                />
                {shouldExpand && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="ml-2 transition-colors text-current"
                  >
                    Analyze
                  </motion.span>
                )}
              </TabsTrigger>
            </motion.div>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
