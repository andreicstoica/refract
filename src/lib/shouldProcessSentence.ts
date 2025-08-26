import type { Sentence } from "@/types/sentence";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Smart sentence filtering to skip obvious non-candidates for prod generation
 */
export function shouldProcessSentence(sentence: Sentence): boolean {
	const text = sentence.text.trim();

    // Skip very short sentences (more permissive for higher prod rate)
    if (text.length < 12) {
        if (isDev) console.log("❌ Sentence too short:", text.substring(0, 30) + "...");
        return false;
    }

	// Skip sentences that are just punctuation or filler
	if (/^[.,!?;:\s-]+$/.test(text)) {
		if (isDev) console.log("❌ Sentence is just punctuation:", text);
		return false;
	}

	// Skip sentences that are just numbers, dates, or simple greetings
	if (/^(\d+|hello|hi|hey|thanks|ok|okay)\.?$/i.test(text)) {
		if (isDev) console.log("❌ Sentence is simple greeting/number:", text);
		return false;
	}

	// Skip sentences that are just URLs, file paths, or email addresses
	if (/^(https?:\/\/|\/[\w\/]+|[\w.-]+@[\w.-]+)/.test(text)) {
		if (isDev) console.log("❌ Sentence is URL/path/email:", text);
		return false;
	}

    // Skip sentences that are mostly formatting or whitespace (more permissive)
    if (text.replace(/[\s\n\r\t]/g, '').length < 8) {
        if (isDev) console.log("❌ Sentence has too little content:", text.substring(0, 30) + "...");
        return false;
    }

	if (isDev) console.log("✅ Sentence passed filters:", text.substring(0, 50) + "...");
	return true;
}
