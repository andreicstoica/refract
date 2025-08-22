import type { Sentence, SentencePosition } from "@/types/sentence";
import { TEXT_STYLES } from "./constants";

const isDev = process.env.NODE_ENV !== "production";

// Cache for mirror element and computed styles
let mirrorElement: HTMLDivElement | null = null;
let cachedStyles: {
  font: string;
  padding: string;
  width: string;
  lineHeight: string;
  overflowWrap: string;
  wordBreak: string;
  boxSizing: string;
  paddingTop: number;
  paddingLeft: number;
} | null = null;

// Memoization cache for position calculations
const positionCache = new Map<string, SentencePosition[]>();
const CACHE_SIZE_LIMIT = 50; // Prevent memory leaks

export function measureSentencePositions(
  sentences: Sentence[],
  textareaElement: HTMLTextAreaElement
): SentencePosition[] {
  if (!textareaElement) return [];

  // Create cache key based on textarea content and sentences
  const textContent = textareaElement.value;
  const sentencesKey = sentences.map(s => `${s.id}:${s.text.length}`).join('|') || '';
  const cacheKey = `${textContent.length}:${sentencesKey}`;

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

  // Cache computed styles to avoid repeated getComputedStyle calls
  if (!cachedStyles) {
    const style = window.getComputedStyle(textareaElement);
    cachedStyles = {
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

  // Apply cached styles to mirror
  mirrorElement.style.font = cachedStyles.font;
  mirrorElement.style.padding = cachedStyles.padding;
  mirrorElement.style.width = cachedStyles.width;
  mirrorElement.style.lineHeight = cachedStyles.lineHeight;
  mirrorElement.style.whiteSpace = "pre-wrap";
  mirrorElement.style.overflowWrap = cachedStyles.overflowWrap;
  mirrorElement.style.wordBreak = cachedStyles.wordBreak;
  mirrorElement.style.boxSizing = cachedStyles.boxSizing;

  if (isDev) {
    console.log("🔧 Using cached styles:", cachedStyles);
  }

  // Optimized HTML building with pre-allocated array
  const text = textareaElement.value;
  const htmlParts: string[] = [];
  let cursor = 0;

  // Pre-calculate sentence positions in text for faster lookup
  const sentencePositions = new Map<string, number>();
  for (const sentence of sentences) {
    const idx = text.indexOf(sentence.text, cursor);
    if (idx !== -1) {
      sentencePositions.set(sentence.id, idx);
      cursor = idx + sentence.text.length;
    }
  }

  // Build HTML more efficiently
  cursor = 0;
  for (const sentence of sentences) {
    const idx = sentencePositions.get(sentence.id);
    if (idx === undefined) continue;

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

  if (isDev) {
    console.log("🔍 Built HTML efficiently with", htmlParts.length, "parts");
  }

  // Align mirror with textarea
  const taRect = textareaElement.getBoundingClientRect();
  mirrorElement.style.left = `${taRect.left + window.scrollX}px`;
  mirrorElement.style.top = `${taRect.top + window.scrollY}px`;

  // Measure positions efficiently
  const results: SentencePosition[] = [];
  const scrollTop = textareaElement.scrollTop || 0;

  for (const sentence of sentences) {
    const el = document.getElementById(`mirror-sent-${sentence.id}`);
    if (!el) {
      if (isDev) console.log("❌ Mirror element not found for sentence:", sentence.id);
      continue;
    }

    const r = el.getBoundingClientRect();
    const position = {
      sentenceId: sentence.id,
      // Position relative to textarea content area (accounting for padding and scroll)
      top: r.top - taRect.top - cachedStyles.paddingTop + scrollTop,
      left: r.left - taRect.left - cachedStyles.paddingLeft,
      width: r.width,
      // Use line height instead of measured height to prevent overlap
      height: cachedStyles.lineHeight ? parseFloat(cachedStyles.lineHeight.replace('px', '') || '56') : r.height,
    };

    results.push(position);
    if (isDev) console.log("📍 Measured position for sentence:", sentence.text.substring(0, 30), position);
  }

  // Cache results and manage cache size
  positionCache.set(cacheKey, results);
  if (positionCache.size > CACHE_SIZE_LIMIT) {
    const firstKey = positionCache.keys().next().value;
    if (firstKey) {
      positionCache.delete(firstKey);
    }
  }

  if (isDev) console.log("🎯 Final position results:", results.length, "positions");
  return results;
}

// Clear cache when needed (e.g., on window resize)
export function clearPositionCache() {
  positionCache.clear();
  cachedStyles = null;
}

