# Highlight Theme View — Spec

## Goal

Add a secondary Themes view that keeps the user’s full text visible and highlights sentence “chunks” belonging to a selected theme. Users can quickly scan where each theme appears in their writing.

## Summary

- Keep a single, scrollable text area showing the full saved text.
- Show a compact row of theme buttons across the top. Each button corresponds to one theme (label + color dot).
- When a theme button is selected, the text area highlights all theme-related chunks with the theme color using MagicUI’s `Highlighter` component.
- Deselecting the theme removes highlights. Support multi-select.

This view complements the current bubble view by providing a linear, document-first representation.

## Scope

- New client component under `src/components/ThemeHighlightView.tsx` renders the layout and handles highlighting logic.
- No backend changes required for MVP. Optional enhancement to persist sentence indices (see Data Mapping).

## UX

- Top bar: small pill buttons for themes.
  - Contents: color dot + label
  - Interaction: click to toggle selection for highlight
- Main pane: full text with highlights.
  - Uses `Highlighter` from MagicUI to render highlight ranges with the selected theme’s color.
    - If no selection, show subdued instructions (“Select a theme to highlight matching sentences”). This should appear above the pill buttons.
- Empty states and edge cases:
  - this should be impossible as we are only arriving from /write. if there is no text/embeddings analysis of that text, just redirect to /write.

## Terminology

- Sentence: result of `splitIntoSentences(fullText)` with `id`, `startIndex`, `endIndex`.
- Chunk: text unit sent to embeddings; currently equal to a sentence in practice, carrying `sentenceId`.
- Theme: AI-labeled cluster of chunks with optional color.

## Data Mapping (revised)

Inputs available on Themes page:

- `themes: Theme[]` from `storage.getThemes()`
- `fullText: string` from `storage.getText()`
- `sentences: Sentence[]` from `storage.getSentences()` (for precise index mapping)

Theme shape (current):

```
interface Theme {
  id: string;
  label: string;
  description?: string;
  confidence: number;
  chunkCount: number;
  color?: string;                 // hex color
  intensity?: number;
  chunks?: Array<{                // Derived from sentences
    text: string;                 // sentence text
    sentenceId: string;           // id assigned during splitting
  }>;
}
```

We need highlight ranges to feed `Highlighter` (precise index mapping):

**Primary approach**: Use persisted `sentences: Sentence[]` from storage to map `sentenceId → { startIndex, endIndex }` directly. This gives precise ranges and handles duplicate text correctly.

**Algorithm**:

1. Build a lookup map: `sentenceMap = { [sentenceId]: sentence }` from `storage.getSentences()`
2. For each chunk in selected themes, use `chunk.sentenceId` to find the exact sentence
3. Extract `{ startIndex, endIndex }` from the sentence to get precise text ranges
4. Create highlight ranges: `{ start: startIndex, end: endIndex, color: theme.color }`
5. Sort ranges by `start` position

Persistence timeline clarification:

- On Done (embeddings): `useGenerateEmbeddings` calls `storage.setText(fullText)` and `storage.setThemes(themes)`. **Add** `storage.setSentences(sentences)` to persist sentence indices.
- Optional hardening: also persist text incrementally on the write page to reduce data loss risk if users navigate away prior to generating.

## Component API

`ThemeHighlightView`

- Props:
  - `themes?: Theme[]` (optional, will fallback to storage if omitted)
  - `className?: string`
- State:
  - `selectedThemeIds: string[]` (MVP: single id; later: multi-select)
  - `highlightRanges: { start: number; end: number; color: string }[]`
- Child components:
  - MagicUI `Highlighter` to render highlights over the plain text

## Pseudo Implementation

Derive ranges for current selection (precise mapping):

```ts
function rangesForTheme(
  sentences: Sentence[], 
  theme: Theme
): Array<{ start: number; end: number; color: string }> {
  // Build sentence lookup map
  const sentenceMap = new Map<string, Sentence>();
  for (const sentence of sentences) {
    sentenceMap.set(sentence.id, sentence);
  }

  const ranges = [];
  const color = theme.color ?? "#93c5fd"; // blue-300 fallback

  for (const chunk of theme.chunks ?? []) {
    const sentence = sentenceMap.get(chunk.sentenceId);
    if (sentence) {
      ranges.push({
        start: sentence.startIndex,
        end: sentence.endIndex,
        color
      });
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}
```

## Highlighter Integration

Reference: https://magicui.design/docs/components/highlighter

Assumptions (adapt if API differs):

- Component accepts `ranges: Array<{ start: number; end: number; color?: string }>`
- Accepts `text: string` or wraps children and uses `contentEditable`/`pre`/`textarea`.

Rendering options:

- Use `pre` with `white-space: pre-wrap` to preserve indices and line breaks.
- Alternatively, if MagicUI wraps a `textarea`, ensure it supports overlay highlights.


## UI Details

- Theme buttons:
  - Size: `sm` buttons in a rounded group container.
  - Contents: small color dot + truncated label.
  - Selected state: filled; unselected: outline.
  - Overflow: horizontal scroll on mobile; wrap on desktop.
- Text area:
  - Monospace optional; keep current typography from write page.
  - `white-space: pre-wrap` to preserve newline indices.
  - Highlights use theme color at ~30–40% alpha for readability.
- Sticky controls: keep theme buttons sticky at top while scrolling text.

## Accessibility

- Buttons are tabbable and operable with Enter/Space.
- `aria-pressed` reflects toggle state for selected theme button(s).
- Provide sufficient contrast for highlight overlays; ensure text remains readable (switch to underline pattern if user prefers reduced transparency).

## Performance

- Sentence mapping: O(1) lookup per chunk using `Map<sentenceId, sentence>` - very fast.
- Range building: O(K) where K = number of chunks in theme.
- Caching: memoize `rangeMap` by `themeId` + `textHash` (e.g., `${text.length}:${sentences.length}`) using an LRU `Map` capped to recent entries.
- Debounce window resize if Highlighter requires layout recalculation.

## Edge Cases

- Missing sentence in map: chunk references `sentenceId` that doesn't exist in stored sentences - skip silently.
- Missing `theme.color`: use palette fallback (blue-300 or derived color ramp).
- No `theme.chunks`: show helper text on selection.
- Text changed after embeddings: gracefully show zero highlights and a soft warning; offer "Regenerate themes".

## Styling

- Follow Tailwind classes and existing tokens; keep controls consistent with `Button` component.
- Use rounded group container matching the look from the bubbles page controls.
- Preserve dark mode styling (adjust highlight alpha accordingly).

## Implementation Plan

1. Build `ThemeHighlightView` (placeholder done) with layout shells for:
   - Sticky theme buttons row
   - Scrollable text pane with `Highlighter`
2. Wire storage:
   - Load `themes` via `storage.getThemes()`, `fullText` via `storage.getText()`, and `sentences` via `storage.getSentences()`
3. Implement precise range builder using sentence index mapping and memoize per theme selection.
4. Hook up theme button click to recompute `ranges` and pass to `Highlighter`.
5. Polish states and empty messages.

## Future Enhancements

- Multi-select themes; layered highlights with subtle borders for overlap.
- Hover a theme button to preview (temporary highlight) without committing selection.
- Per-highlight tooltips showing the confidence.
- Export highlighted text snippets per theme.
- Auto-scroll to first highlighted range when theme is selected (smooth scroll with `scrollIntoView`).
