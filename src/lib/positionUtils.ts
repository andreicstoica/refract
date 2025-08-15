import type { Sentence } from "./sentenceUtils";

export interface SentencePosition {
  sentenceId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

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
      html += `<span id="mirror-sent-${s.id}">${s.text
        .replace(/ /g, "&nbsp;")
        .replace(/\n/g, "<br/>")}</span>`;
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

  // Align mirror with textarea
  const taRect = textareaElement.getBoundingClientRect();
  mirror.style.left = `${taRect.left + window.scrollX}px`;
  mirror.style.top = `${taRect.top + window.scrollY}px`;

  // Measure
  return sentences
    .map((s) => {
      const el = document.getElementById(`mirror-sent-${s.id}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        sentenceId: s.id,
        top: r.top - taRect.top,
        left: r.left - taRect.left,
        width: r.width,
        height: r.height,
      };
    })
    .filter(Boolean) as SentencePosition[];
}