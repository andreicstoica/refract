"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ThemeBubbleContainer } from "@/components/ThemeBubbleContainer";
import { motion } from "framer-motion";

interface Theme {
  id: string;
  label: string;
  description?: string;
  confidence: number;
  chunkCount: number;
  chunks?: Array<{ text: string; sentenceId: string }>;
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");

  // Load themes from localStorage or recent session
  useEffect(() => {
    const savedThemes = localStorage.getItem("refract-themes");
    const savedText = localStorage.getItem("refract-text");

    if (savedThemes) {
      setThemes(JSON.parse(savedThemes));
    }
    if (savedText) {
      setSelectedText(savedText);
    }
  }, []);

  const regenerateThemes = async () => {
    if (!selectedText.trim()) return;

    setIsLoading(true);
    try {
      // Parse sentences from text (simple sentence splitting)
      const sentences = selectedText
        .split(/[.!?]+/)
        .map((sentence, index) => ({
          id: `sentence-${index}`,
          text: sentence.trim(),
          startIndex: 0,
          endIndex: sentence.length,
        }))
        .filter((s) => s.text.length > 0);

      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences,
          fullText: selectedText,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate themes");

      const data = await response.json();
      setThemes(data.themes || []);

      // Save to localStorage
      localStorage.setItem("refract-themes", JSON.stringify(data.themes || []));
    } catch (error) {
      console.error("Failed to regenerate themes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-dvh bg-background text-foreground">
      {/* Header */}
      <div className="relative z-10 p-4 border-b border-border/50">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/write">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Writing
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Reflection Themes</h1>
              <p className="text-sm text-muted-foreground">
                Explore the themes in your writing
              </p>
            </div>
          </div>

          {selectedText && (
            <Button
              onClick={regenerateThemes}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate Themes
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {themes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto h-full"
          >
            <ThemeBubbleContainer
              themes={themes}
              onThemeSelect={(themeId) => {
                console.log("Selected theme:", themeId);
              }}
              className="h-full"
            />
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-md"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 opacity-60" />
              </div>

              <h2 className="text-2xl font-semibold mb-3">No Themes Yet</h2>
              <p className="text-muted-foreground mb-6">
                Start writing to see your thoughts organized into meaningful
                themes. The AI will identify patterns and connections in your
                reflections.
              </p>

              <Link href="/write">
                <Button>
                  Start Writing
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
