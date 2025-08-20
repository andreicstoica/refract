import type { Sentence } from "@/types/sentence";

// Lightweight, dependency-free sentence splitter that preserves indices.
// Rules:
// - End a sentence on '.', '!' or '?' when followed by whitespace or EoS
// - Preserve the exact substring (no trimming) to keep start/end indices stable
// - If no terminal punctuation exists, return the whole text as a single sentence
export function splitIntoSentences(inputText: string): Sentence[] {
  const text = String(inputText);
  if (!text.trim()) return [];

  const sentences: Sentence[] = [];
  let start = 0;

  const isTerminal = (ch: string) => ch === "." || ch === "!" || ch === "?";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isTerminal(ch)) {
      // lookahead: whitespace, newline, or end of string
      const next = text[i + 1];
      if (i === text.length - 1 || /\s/.test(next)) {
        const raw = text.slice(start, i + 1);
        // Trim leading whitespace from sentence content, but adjust indices accordingly
        const leadingWs = raw.match(/^\s+/)?.[0].length ?? 0;
        const sentenceText = raw.slice(leadingWs);
        if (sentenceText.length > 0) {
          sentences.push({
            id: `sentence-${sentences.length}`,
            text: sentenceText,
            startIndex: start + leadingWs,
            endIndex: start + leadingWs + sentenceText.length,
          });
        }
        // advance start to the next non-sentence character (likely whitespace)
        start = i + 1;
      }
    }
  }

  // Remainder (no terminal punctuation): treat as a single sentence
  if (sentences.length === 0) {
    return [
      {
        id: "sentence-0",
        text,
        startIndex: 0,
        endIndex: text.length,
      },
    ];
  }

  return sentences;
}
