import type { Sentence } from "@/types/sentence";

/**
 * Smart sentence filtering to skip obvious non-candidates for prod generation
 */
export function shouldProcessSentence(sentence: Sentence): boolean {
    const text = sentence.text.trim();

    // Skip very short sentences
    if (text.length < 25) return false;

    // Skip sentences that are just punctuation or filler
    if (/^[.,!?;:\s-]+$/.test(text)) return false;

    // Skip sentences that are just numbers, dates, or simple greetings
    if (/^(\d+|hello|hi|hey|thanks|ok|okay)\.?$/i.test(text)) return false;

    // Skip sentences that are just URLs, file paths, or email addresses
    if (/^(https?:\/\/|\/[\w\/]+|[\w.-]+@[\w.-]+)/.test(text)) return false;

    // Skip sentences that are mostly formatting or whitespace
    if (text.replace(/[\s\n\r\t]/g, '').length < 15) return false;

    return true;
}
