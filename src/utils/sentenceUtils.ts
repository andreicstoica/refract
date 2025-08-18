import nlp from "compromise";
import type { Sentence } from "@/types/sentence";

export function splitIntoSentences(inputText: string): Sentence[] {
  if (!inputText.trim()) return [];

  const doc = nlp(inputText);
  const nlpSentences = doc.sentences().json();

  const result: Sentence[] = [];
  let currentIndex = 0;

  nlpSentences.forEach((sentence: any, index: number) => {
    const sentenceText = sentence.text;
    const startIndex = inputText.indexOf(sentenceText, currentIndex);
    const endIndex = startIndex + sentenceText.length;

    result.push({
      text: sentenceText,
      startIndex,
      endIndex,
      id: `sentence-${index}`, // Remove Date.now() to keep IDs stable
    });

    currentIndex = endIndex;
  });

  console.log("📝 Split sentences:", result.map(s => ({ id: s.id, text: s.text })));
  return result;
}