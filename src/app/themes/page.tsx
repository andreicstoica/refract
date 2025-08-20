"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ThemeBubbleContainer } from "@/components/ThemeBubbleContainer";
import { ThemeHighlightView } from "@/components/ThemeHighlightView";
import { Button } from "@/components/ui/button";

import type { Theme } from "@/types/theme";
import { storage } from "@/services/storage";

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [view, setView] = useState<"bubbles" | "secondary">("bubbles");

  // Load themes from localStorage or recent session
  useEffect(() => {
    const savedThemes = storage.getThemes();
    const savedText = storage.getText();

    if (savedThemes) {
      setThemes(savedThemes);
    }
    if (savedText) {
      setSelectedText(savedText);
    }
  }, []);

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      {/* Write Again Button - positioned like WritingNav */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
        <Link href="/write">
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
              delay: 0.1,
            }}
            className="relative overflow-hidden px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-700 dark:text-blue-300 font-medium text-sm transition-all duration-200 hover:from-blue-500/30 hover:to-purple-500/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-sm"
          >
            {/* Background glow effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full"
              initial={{ opacity: 0, scale: 1 }}
              whileHover={{ opacity: 1, scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />

            {/* Button content */}
            <span className="relative z-10 flex items-center gap-2">
              <motion.div
                className="w-2 h-2 bg-blue-400 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              Write Again
            </span>

            {/* Subtle pulse effect */}
            <motion.div
              className="absolute inset-0 rounded-full border border-blue-400/20"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="p-4 pt-20 h-full">
        {/* View toggle */}
        {themes.length > 0 && (
          <div className="mb-3 flex w-full items-center justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border bg-background/80 p-1 shadow-sm">
              <Button
                size="sm"
                variant={view === "bubbles" ? "default" : "outline"}
                onClick={() => setView("bubbles")}
                className="rounded-full px-3"
              >
                Bubbles
              </Button>
              <Button
                size="sm"
                variant={view === "secondary" ? "default" : "outline"}
                onClick={() => setView("secondary")}
                className="rounded-full px-3"
              >
                Secondary
              </Button>
            </div>
          </div>
        )}
        {themes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            {view === "bubbles" ? (
              <ThemeBubbleContainer
                themes={themes}
                onThemeSelect={(themeId) => {
                  console.log("Selected theme:", themeId);
                }}
                className="w-full h-full"
              />
            ) : (
              <ThemeHighlightView className="w-full h-full" />
            )}
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative overflow-hidden px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-700 dark:text-blue-300 font-medium text-sm transition-all duration-200 hover:from-blue-500/30 hover:to-purple-500/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-sm"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 bg-blue-400 rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 1, 0.6],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    Start Writing
                  </span>
                </motion.button>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
