# Architecture Notes

This document captures the high-level writing flow so reviewers can map hooks, providers, and queues back to the product story. README keeps the summary; this file goes deeper and stores references to diagrams or rationale that would otherwise end up as ad-hoc comments.

## Information Flow Snapshot

1. `TimingConfigProvider` (App Router layout) detects demo mode once, memoizes `getTimingConfig`, and surfaces `{ isDemoMode, config }`.
2. `TextInput` composes the editor pipeline:
	- `useEditorText` owns the textarea ref, text value, focus, and line metrics.
	- `useSentenceTracker` translates `{ text, textareaRef }` into sentence arrays with cached measurements.
	- `useProdTriggers` watches `{ text, sentences }`, applies timer heuristics, and invokes prod enqueue actions.
3. `ProdsProvider` wraps the writing surface and exposes queue actions (`enqueue`, `pin`, `notifyTopicShift`, etc.) plus memoized selectors for overlays and chips.
4. `ThemesProvider` (future) and highlight overlays consume the same text + sentence structures to keep animations aligned with chip placement.

See `docs/diagrams/writing-flow.mmd` for the overall pipeline and `docs/diagrams/prod-triggers.mmd` for the timer + heuristic sequence that feeds the queue.

## App Shell

- `app/layout.tsx` imports `TimingConfigProvider`, `ThemeProvider`, and any persistent HUD components (timer shell, toasts).
- Layout props (demo/write) provide path context; only the provider inspects `usePathname`, so child hooks stay deterministic.
- Config values that matter to multiple systems (prod timing, highlight thresholds, queue sizes) live in `src/features/config/timing.ts` (planned) and are injected via the provider hook.

## Writing Surface Pipeline

| Layer | Responsibility | Key Files |
| --- | --- | --- |
| `useEditorText` | Controlled textarea value, cursor/focus, derived metrics | `src/features/writing/hooks/useEditorText.ts` (WIP) |
| `useSentenceTracker` | Sentence tokenization, measurement caching (`measureSentencePositions`) | `src/features/writing/hooks/useSentenceTracker.ts` + `src/lib/sentences.ts` |
| `useProdTriggers` | Debounce + watchdog timers, heuristics (`shouldTriggerProd`) | `src/features/prods/hooks/useProdTriggers.ts` + `src/lib/prodTriggerRules.ts` |
| Visualization | `ChipOverlay`, `HighlightOverlay`, `ThemeOverlay` read shared sentence data to stay aligned | `src/components/ChipOverlay.tsx`, `src/components/highlight/*` |

Observability hooks (e.g., logging, debug counters) should subscribe at the provider level instead of re-implementing inside each hook. Timer and debounce durations should always come from `useTimingConfig()` to keep `/demo` vs `/write` in sync.

## Prods System

- `ProdsProvider` wraps the editor stack on `/write` and `/demo`.
- `useProdQueueManager` (existing) will split into:
	1. `useProdQueue` (pure reducer for enqueue, dedupe, pin, drop oldest, topic-shift reset).
	2. `useProdTelemetry` (timings, watchdog resets, queue length metrics).
- Chip layout is delegated to `src/services/chipLayoutService.ts` so the provider only exposes logical positions (sentence id, offsets, max width). Chip overlays just render the placements they receive.
- `docs/diagrams/prod-queue.mmd` captures the queue transitions (initial, pending request, fulfilled, pinned, dropped).

### Queue Invariants

- Dedupe uses `makeFingerprint(text)`; new hooks must pass fingerprints to avoid resurfacing identical text across topic resets.
- `notifyTopicShift()` flushes transient chips (non-pinned) and resets timers in `useProdTriggers`.
- `pinnedIds` survives queue clears; layout re-uses previous placements when possible (`tryReusePinnedPlacement`), so we document pinning expectations here instead of littering comments in layout helpers.

## Theme Analysis & Map

- `useThemeAnalysis` reads sentences + full text, requests embeddings via `/api/embeddings`, and pushes results into `ThemesProvider`.
- Highlight flows (`HighlightOverlay`, `TextWithHighlights`) rely on `assignChunkIndices` to keep animation timing deterministic even as theme stacks change.
- The map view uses the same provider but different consumers (bubble map vs highlight overlay). Shared contracts should sit in `src/features/themes/context/ThemeProvider.tsx`.

## Diagram Guidance

- Store Mermaid sources under `docs/diagrams/` with filenames that match the feature (`writing-flow.mmd`, `prod-queue.mmd`). Generate PNG/SVG artifacts only when needed for decks; the repo keeps the text sources for easy diffs.
- Link diagrams back here using relative paths so GitHub renders them inline:

```md
![Writing flow](./diagrams/writing-flow.mmd)
```

- Keep diagrams focused on information flow (inputs → hooks → consumers). Sequence diagrams for timers, box diagrams for providers/hooks, and call out shared config boundaries.

### Diagram Index

- `writing-flow.mmd` — Editor → hooks → providers → overlays (Mermaid flowchart).
- `prod-queue.mmd` — State diagram for queue transitions (enqueue, pin, drop, reset).
- `prod-triggers.mmd` — Sequence diagram for timer heuristics and watchdog triggers flowing into the queue.
- Add highlight/theme diagrams once theme refactor ships.

## Commentary Expectations

- Inline comments belong above the branch or loop they justify (e.g., explaining the guard around timer resets or chip collision fallbacks). They describe intent, not implementation.
- Exported hooks/providers receive doc comments outlining inputs, outputs, and invariants (e.g., "`useProdTriggers` assumes timers fire on settled text; call `resetTriggers` whenever the queue flushes").
- TODOs must pair an owner/tag and outcome (`TODO(andrei): Revisit watchdog delay once prod telemetry lands`). Delete logging-style breadcrumbs before shipping.

## Diagram Guidance

- Store Mermaid sources under `docs/diagrams/` with filenames that match the feature (`writing-flow.mmd`, `prod-queue.mmd`). Generate PNG/SVG artifacts only when needed for decks; the repo keeps the text sources for easy diffs.
- Link diagrams back here using relative paths so GitHub renders them inline:

```md
![Writing flow](./diagrams/writing-flow.mmd)
```

- Keep diagrams focused on information flow (inputs → hooks → consumers). Sequence diagrams for timers, box diagrams for providers/hooks, and call out shared config boundaries.

## Future Work

- Keep prod trigger diagrams up to date as `useProdTriggers` migrates into the new queue pipeline.
- Document telemetry touchpoints (e.g., queue length metrics, prod API latency) when instrumentation lands.
