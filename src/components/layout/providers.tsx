"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { EmbeddingsProvider } from "@/features/ai/EmbeddingsProvider";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <EmbeddingsProvider>{children}</EmbeddingsProvider>
    </ThemeProvider>
  );
}
