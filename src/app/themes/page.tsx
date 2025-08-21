"use client";

import { useState, useEffect } from "react";
import { AppNav } from "@/components/AppNav";
import { ViewToggleNav } from "@/components/ViewToggleNav";
import { ThemeBubbleContainer } from "@/components/ThemeBubbleContainer";
import { ThemeHighlightView } from "@/components/ThemeHighlightView";
import { LoadingState } from "@/components/highlight/LoadingState";
import { useRouter } from "next/navigation";

import type { Theme } from "@/types/theme";
import { storage } from "@/services/storage";

export default function ThemesPage() {
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [view, setView] = useState<"bubbles" | "highlights">("bubbles");
  const [isLoading, setIsLoading] = useState(false);

  // Load themes from localStorage or handle fresh analysis
  useEffect(() => {
    const analysisStatus = localStorage.getItem("refract-analysis");

    if (analysisStatus === "running") {
      // Fresh analysis starting - clear old themes and show loading
      setThemes([]);
      setIsLoading(true);

      // Poll for new themes with better logging
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        console.log(`🔄 Polling for themes... attempt ${pollCount}`);

        const newThemes = storage.getThemes();
        const newText = storage.getText();

        if (newThemes && newThemes.length > 0) {
          console.log(
            `✅ Found ${newThemes.length} themes after ${pollCount} polls`
          );
          setThemes(newThemes);
          if (newText) {
            setSelectedText(newText);
          }
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
        console.error(
          "❌ Analysis timeout after 60s - falling back to saved themes"
        );

        // Fallback to any existing themes
        const fallbackThemes = storage.getThemes();
        if (fallbackThemes) {
          setThemes(fallbackThemes);
        } else {
          // If no fallback themes, show an error message
          console.error("❌ No themes available for fallback");
        }
      }, 60000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    } else {
      // No fresh analysis - load existing themes
      const savedThemes = storage.getThemes();
      const savedText = storage.getText();

      if (savedThemes) {
        setThemes(savedThemes);
      }

      if (savedText) {
        setSelectedText(savedText);
      }
    }
  }, []);

  const handleTabChange = (tab: "write" | "reflect") => {
    if (tab === "write") {
      router.push("/write");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="relative h-dvh overflow-hidden bg-background text-foreground">
        <AppNav active="reflect" onTabChange={handleTabChange} />

        <div className="p-4 pt-8 h-full">
          <LoadingState
            message="Analyzing your writing..."
            showSkeletons={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      <AppNav active="reflect" onTabChange={handleTabChange} />

      {/* View Toggle Nav */}
      {themes.length > 0 && (
        <ViewToggleNav active={view} onViewChange={setView} />
      )}

      {/* Main Content */}
      <div className="p-4 pt-8 h-full">
        {/* Content */}
        <div className="h-full">
          {view === "bubbles" ? (
            <ThemeBubbleContainer themes={themes} />
          ) : (
            <ThemeHighlightView themes={themes} />
          )}
        </div>
      </div>
    </div>
  );
}
