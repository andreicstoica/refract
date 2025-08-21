"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { LoadingState } from "@/components/highlight/LoadingState";
import { ThemeHighlightView } from "@/components/ThemeHighlightView";
import { storage } from "@/services/storage";
import type { Theme } from "@/types/theme";

export default function ThemesPage() {
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [fullText, setFullText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Load themes from localStorage or handle fresh analysis
  useEffect(() => {
    const analysisStatus = localStorage.getItem("refract-analysis");

    if (analysisStatus === "running") {
      // Fresh analysis starting - clear old themes and show loading
      setThemes([]);
      setIsLoading(true);

      // Poll for new themes
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        const newThemes = storage.getThemes();
        const newText = storage.getText();

        if (newThemes && newThemes.length > 0) {
          setThemes(newThemes);
          if (newText) setFullText(newText);
          setIsLoading(false);
          localStorage.removeItem("refract-analysis");
          clearInterval(pollInterval);
        }
      }, 500);

      // Clear interval after 60 seconds to prevent infinite polling
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        setIsLoading(false);
        localStorage.removeItem("refract-analysis");

        // Fallback to any existing themes
        const fallbackThemes = storage.getThemes();
        if (fallbackThemes) setThemes(fallbackThemes);
        const savedText = storage.getText();
        if (savedText) setFullText(savedText);
      }, 60000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    } else {
      // No fresh analysis - load existing themes
      const savedThemes = storage.getThemes();
      const savedText = storage.getText();
      if (savedThemes) setThemes(savedThemes);
      if (savedText) setFullText(savedText);
    }
  }, []);

  const handleTabChange = (tab: "write" | "reflect") => {
    if (tab === "write") router.push("/write");
  };

  if (isLoading) {
    return (
      <div className="relative h-dvh overflow-hidden bg-background text-foreground flex flex-col">
        <AppNav active="reflect" onTabChange={handleTabChange} />
        <div className="flex-1 min-h-0 p-4 pt-8">
          <LoadingState message="Analyzing your writing..." showSkeletons={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground flex flex-col">
      <AppNav active="reflect" onTabChange={handleTabChange} />
      <div className="flex-1 min-h-0 p-4 pt-8">
        <ThemeHighlightView themes={themes} fullText={fullText} />
      </div>
    </div>
  );
}
