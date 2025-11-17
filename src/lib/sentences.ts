import { debug } from "@/lib/debug";
import type { Sentence, SentencePosition } from "@/types/sentence";

// Lightweight, dependency-free sentence splitter that preserves indices.
// Rules:
// - End a sentence on '.', '!' or '?' when followed by whitespace or EoS
// - Treat newline characters as soft sentence boundaries for writers who press Enter
// - Preserve the exact substring (no trimming) to keep start/end indices stable
// - If no terminal punctuation or newline boundary exists, return the whole text as a single sentence
export function splitIntoSentences(inputText: string): Sentence[] {
	const text = String(inputText);
	if (!text.trim()) return [];

	const sentences: Sentence[] = [];
	let start = 0;

	const isTerminal = (ch: string) => ch === "." || ch === "!" || ch === "?";
	const isNewline = (ch: string) => ch === "\n" || ch === "\r";

	const pushSentence = (rangeStart: number, rangeEnd: number) => {
		if (rangeEnd <= rangeStart) return;
		const raw = text.slice(rangeStart, rangeEnd);
		const leadingWs = raw.match(/^\s+/)?.[0].length ?? 0;
		const sentenceText = raw.slice(leadingWs);
		if (sentenceText.length === 0) return;
		const normalizedText = sentenceText.trim().toLowerCase().replace(/\s+/g, " ");
		const contentHash = normalizedText.slice(0, 20);
		const startPos = rangeStart + leadingWs;
		sentences.push({
			id: `sentence-${startPos}-${contentHash.replace(/[^\w]/g, "").slice(0, 10)}`,
			text: sentenceText,
			startIndex: startPos,
			endIndex: rangeStart + leadingWs + sentenceText.length,
		});
	};

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (isTerminal(ch)) {
			// lookahead: whitespace, newline, or end of string
			const next = text[i + 1];
			if (i === text.length - 1 || /\s/.test(next)) {
				pushSentence(start, i + 1);
				start = i + 1;
			}
			continue;
		}

		if (isNewline(ch)) {
			pushSentence(start, i);
			if (ch === "\r" && text[i + 1] === "\n") {
				i += 1;
				start = i + 1;
			} else {
				start = i + 1;
			}
		}
	}

	if (start < text.length || sentences.length === 0) {
		pushSentence(start, text.length);
	}

	return sentences;
}

// Cache for mirror element and position calculations
let mirrorElement: HTMLDivElement | null = null;
const positionCache = new Map<string, SentencePosition[]>();
const CACHE_SIZE_LIMIT = 50;

function getTextAreaStyles(textareaElement: HTMLTextAreaElement) {
  const style = window.getComputedStyle(textareaElement);
  return {
    font: style.font,
    padding: style.padding,
    width: style.width,
    lineHeight: style.lineHeight,
    overflowWrap: (style as any).overflowWrap || (style as any)["overflow-wrap"] || "anywhere",
    wordBreak: style.wordBreak,
    boxSizing: style.boxSizing,
    paddingTop: parseFloat(style.paddingTop) || 0,
    paddingLeft: parseFloat(style.paddingLeft) || 0,
  };
}

export function measureSentencePositions(
  sentences: Sentence[],
  textareaElement: HTMLTextAreaElement
): SentencePosition[] {
  if (!textareaElement || sentences.length === 0) return [];

  const text = textareaElement.value;
  const cacheKey = `${text.length}:${sentences.map(s => s.id).join(',')}`;

  // Check cache first
  if (positionCache.has(cacheKey)) {
    return positionCache.get(cacheKey)!;
  }

  // Create or reuse mirror element
  if (!mirrorElement) {
    mirrorElement = document.createElement("div");
    mirrorElement.id = "textarea-mirror-measure";
    mirrorElement.style.position = "absolute";
    mirrorElement.style.visibility = "hidden";
    mirrorElement.style.whiteSpace = "pre-wrap";
    mirrorElement.style.wordBreak = "break-word";
    mirrorElement.style.pointerEvents = "none";
    document.body.appendChild(mirrorElement);
  }

  // Apply textarea styles to mirror
  const styles = getTextAreaStyles(textareaElement);
  mirrorElement.style.font = styles.font;
  mirrorElement.style.padding = styles.padding;
  mirrorElement.style.width = styles.width;
  mirrorElement.style.lineHeight = styles.lineHeight;
  mirrorElement.style.whiteSpace = "pre-wrap";
  mirrorElement.style.overflowWrap = styles.overflowWrap;
  mirrorElement.style.wordBreak = styles.wordBreak;
  mirrorElement.style.boxSizing = styles.boxSizing;

  // Build HTML with sentence spans
  const htmlParts: string[] = [];
  let cursor = 0;

  for (const sentence of sentences) {
    const idx = text.indexOf(sentence.text, cursor);
    if (idx === -1) continue;

    if (idx > cursor) {
      htmlParts.push(text
        .slice(cursor, idx)
        .replace(/ /g, "&nbsp;")
        .replace(/\n/g, "<br/>"));
    }

    // Preserve newlines in sentence measurement - don't strip them
    const sentenceHtml = sentence.text
      .replace(/ /g, "&nbsp;")
      .replace(/\n/g, "<br/>");
    htmlParts.push(`<span id="mirror-sent-${sentence.id}">${sentenceHtml}</span>`)

    cursor = idx + sentence.text.length;
  }

  if (cursor < text.length) {
    htmlParts.push(text
      .slice(cursor)
      .replace(/ /g, "&nbsp;")
      .replace(/\n/g, "<br/>"));
  }

  mirrorElement.innerHTML = htmlParts.join('');

  // Position mirror element
  const taRect = textareaElement.getBoundingClientRect();
  mirrorElement.style.left = `${taRect.left + window.scrollX}px`;
  mirrorElement.style.top = `${taRect.top + window.scrollY}px`;

  // Measure sentence positions
  const results: SentencePosition[] = [];
  // Note: We do NOT include scrollTop here. Positions are in content coordinates
  // so overlays can translate by -scrollTop and remain stable during scroll.

  for (const sentence of sentences) {
    const el = document.getElementById(`mirror-sent-${sentence.id}`);
    if (!el) continue;

    const r = el.getBoundingClientRect();
    const rawLeft = r.left - taRect.left - styles.paddingLeft;
    const position = {
      sentenceId: sentence.id,
      top: r.top - taRect.top - styles.paddingTop,
      // Ensure left never falls before the start of textarea content
      left: Math.max(0, rawLeft),
      width: r.width,
      height: parseFloat(styles.lineHeight.replace('px', '')) || 56,
    };

    results.push(position);
    debug.dev("📍 Measured position for sentence:", sentence.text.substring(0, 30), position);
  }

  // Cache results
  positionCache.set(cacheKey, results);
  if (positionCache.size > CACHE_SIZE_LIMIT) {
    const firstKey = positionCache.keys().next().value;
    if (firstKey) {
      positionCache.delete(firstKey);
    }
  }

  return results;
}

// Clear cache when needed (e.g., on window resize)
export function clearPositionCache() {
  positionCache.clear();
}
