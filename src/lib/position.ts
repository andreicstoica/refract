import type { Sentence, SentencePosition } from "@/types/sentence";
import type { Prod } from "@/types/prod";

const isDev = process.env.NODE_ENV !== "production";

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

    const sentenceText = sentence.text.replace(/\n/g, "");
    htmlParts.push(`<span id="mirror-sent-${sentence.id}">${sentenceText
      .replace(/ /g, "&nbsp;")}</span>`);

    if (sentence.text.endsWith('\n')) {
      htmlParts.push("<br/>");
    }

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
  const scrollTop = textareaElement.scrollTop || 0;

  for (const sentence of sentences) {
    const el = document.getElementById(`mirror-sent-${sentence.id}`);
    if (!el) continue;

    const r = el.getBoundingClientRect();
    const rawLeft = r.left - taRect.left - styles.paddingLeft;
    const position = {
      sentenceId: sentence.id,
      top: r.top - taRect.top - styles.paddingTop + scrollTop,
      // Ensure left never falls before the start of textarea content
      left: Math.max(0, rawLeft),
      width: r.width,
      height: parseFloat(styles.lineHeight.replace('px', '')) || 56,
    };

    results.push(position);
    if (isDev) {
      console.log("📍 Measured position for sentence:", sentence.text.substring(0, 30), position);
    }
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

export function calculateHorizontalOffsets(
  prods: Prod[]
): Map<string, number> {
  const horizontalOffsetByProdId = new Map<string, number>();
  const chipWidthBySentence = new Map<string, number>();

  // Sort prods by timestamp to ensure consistent ordering
  const sortedProds = [...prods].sort((a, b) => a.timestamp - b.timestamp);

  for (const prod of sortedProds) {
    const currentWidth = chipWidthBySentence.get(prod.sentenceId) || 0;
    
    // Estimate chip width based on text length
    const estimatedWidth = Math.max(120, prod.text.length * 8) + 40;
    
    horizontalOffsetByProdId.set(prod.id, currentWidth);
    chipWidthBySentence.set(prod.sentenceId, currentWidth + estimatedWidth + 8);
  }

  return horizontalOffsetByProdId;
}

// Clear cache when needed (e.g., on window resize)
export function clearPositionCache() {
  positionCache.clear();
}
