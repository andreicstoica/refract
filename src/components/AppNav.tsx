"use client";

import { PencilLine, Binoculars } from "lucide-react";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AppNavProps {
  active: "write" | "reflect";
  onTabChange: (tab: "write" | "reflect") => void;
  analyzeDisabled?: boolean;
  className?: string;
}

export function AppNav({
  active,
  onTabChange,
  analyzeDisabled = false,
  className,
}: AppNavProps) {
  const handleTabChange = (value: string) => {
    if (value === "write" || value === "reflect") {
      onTabChange(value);
    }
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-50 w-full",
        "bg-background/80 backdrop-blur-sm border-b border-border/50",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-center max-w-2xl mx-auto">
        {/* Centered Tabs */}
        <Tabs value={active} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="write" className="flex items-center gap-2">
              <PencilLine className="w-4 h-4" />
              Write
            </TabsTrigger>
            <TabsTrigger
              value="reflect"
              className="flex items-center gap-2"
              disabled={analyzeDisabled}
            >
              <Binoculars className="w-4 h-4" />
              Analyze
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
