"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { EmbeddingsProvider } from "@/features/ai/EmbeddingsProvider";
import { TimingConfigProvider } from "@/features/config/TimingConfigProvider";

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
      <TimingConfigProvider>
        <EmbeddingsProvider>{children}</EmbeddingsProvider>
      </TimingConfigProvider>
    </ThemeProvider>
  );
}
