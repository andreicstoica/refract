import type { Sentence, SentencePosition } from "@/types/sentence";
import { TEXT_STYLES } from "./constants";

export function measureSentencePositions(
  sentences: Sentence[],
  textareaElement: HTMLTextAreaElement
): SentencePosition[] {
  if (!textareaElement) return [];

  // Create hidden mirror div if needed
  let mirror = document.getElementById(
    "textarea-mirror-measure"
  ) as HTMLDivElement | null;
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.id = "textarea-mirror-measure";
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.pointerEvents = "none";
    document.body.appendChild(mirror);
  }

  // Copy textarea styles (just the essentials)
  const style = window.getComputedStyle(textareaElement);
  mirror.style.font = style.font;
  mirror.style.padding = style.padding;
  mirror.style.width = style.width;
  mirror.style.lineHeight = style.lineHeight; // Add line height for accurate positioning

  // Ensure we have the correct line height from our constants
  console.log("🔧 Mirror styles:", {
    font: mirror.style.font,
    padding: mirror.style.padding,
    width: mirror.style.width,
    lineHeight: mirror.style.lineHeight,
    expectedLineHeight: TEXT_STYLES.LINE_HEIGHT
  });

  // Build mirror HTML with <span> for each sentence
  let cursor = 0;
  const text = textareaElement.value;
  let html = "";
  for (const s of sentences) {
    const idx = text.indexOf(s.text, cursor);
    if (idx > cursor) {
      html += text
        .slice(cursor, idx)
        .replace(/ /g, "&nbsp;")
        .replace(/\n/g, "<br/>");
    }
    if (idx !== -1) {
      // Don't include line breaks in the sentence span - they should be outside
      const sentenceText = s.text.replace(/\n/g, ""); // Remove line breaks from sentence text
      html += `<span id="mirror-sent-${s.id}">${sentenceText
        .replace(/ /g, "&nbsp;")}</span>`;

      // Add line break after sentence if it ends with one
      if (s.text.endsWith('\n')) {
        html += "<br/>";
      }

      cursor = idx + s.text.length;
    }
  }
  if (cursor < text.length) {
    html += text
      .slice(cursor)
      .replace(/ /g, "&nbsp;")
      .replace(/\n/g, "<br/>");
  }
  mirror.innerHTML = html;

  console.log("🔍 Mirror HTML:", html);
  console.log("🔍 Textarea value:", text);
  console.log("🔍 Sentences:", sentences.map(s => ({ id: s.id, text: s.text })));

  // Align mirror with textarea
  const taRect = textareaElement.getBoundingClientRect();
  mirror.style.left = `${taRect.left + window.scrollX}px`;
  mirror.style.top = `${taRect.top + window.scrollY}px`;

  console.log("🔍 Textarea rect:", taRect);

  // Measure
  const results = sentences
    .map((s) => {
      const el = document.getElementById(`mirror-sent-${s.id}`);
      if (!el) {
        console.log("❌ Mirror element not found for sentence:", s.id);
        return null;
      }
      const r = el.getBoundingClientRect();
      const position = {
        sentenceId: s.id,
        top: r.top - taRect.top,
        left: r.left - taRect.left,
        width: r.width,
        height: r.height,
      };
      console.log("📍 Measured position for sentence:", s.text, position);
      return position;
    })
    .filter(Boolean) as SentencePosition[];

  console.log("🎯 Final position results:", results);
  return results;
}