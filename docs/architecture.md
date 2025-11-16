# Architecture Notes

This document captures the high-level writing flow so reviewers can map hooks, providers, and queues back to the product story. README keeps the summary; this file goes deeper and stores references to diagrams or rationale that would otherwise end up as ad-hoc comments.

## Directory Conventions

- `src/features/*` own end-to-end slices (writing, prods, themes, ui). Hooks, providers, and React state live beside the feature that consumes them; themes now includes the embeddings provider/services that power clustering.
- `src/features/*/services` wrap effectful helpers (fetch clients, AbortControllers, `localStorage` access) scoped to that feature.
- `src/lib/*` houses pure utilities—sentence parsing, chip layout math, highlight helpers, timing constants—that multiple features share.

## Information Flow Snapshot

1. `TimingConfigProvider` (App Router layout) detects demo mode once, memoizes `getTimingConfig`, and surfaces `{ isDemoMode, config }`.
2. `TextInput` composes the writing pipeline in priority order:
	- `useTopicShiftDetection` extracts keywords, feeds `updateTopicContext({ keywords, version })`, and fires `notifyTopicShift()` so queue state resets the moment a micro-shift lands.
	- `useEditorText` owns the textarea ref, text value, focus, and line metrics.
	- `useSentenceTracker` translates `{ text, textareaRef }` into sentence arrays with cached measurements.
	- `useProdTriggers` watches `{ text, sentences }`, applies timer heuristics/watchdog logic, and invokes prod enqueue actions via the provider.
3. `ProdsProvider` (backed by `useProdQueueManager`) wraps the writing surface and exposes queue actions (`enqueue`, `pin`, `notifyTopicShift`, `updateTopicContext`, etc.) plus memoized selectors for overlays, pins, and cached sentences. The provider now supervises a multi-flight queue: up to two concurrent prod requests on `/write` (three on `/demo`) to keep throughput high even when individual API calls approach the timeout.
4. `EmbeddingsProvider` (themes feature) and highlight overlays consume the same text + sentence structures to keep animations aligned with chip placement.

See `docs/diagrams/writing-flow.mmd` for the overall pipeline and `docs/diagrams/prod-triggers.mmd` for the timer + heuristic sequence that feeds the queue.

## App Shell

- `app/layout.tsx` imports `TimingConfigProvider`, `ThemeProvider`, and any persistent HUD components (timer shell, toasts).
- Layout props (demo/write) provide path context; only the provider inspects `usePathname`, so child hooks stay deterministic.
- Config values that matter to multiple systems (prod timing, highlight thresholds, queue sizes) live in `src/features/config/timing.ts` (planned) and are injected via the provider hook.

## Writing Surface Pipeline

| Layer | Responsibility | Key Files |
| --- | --- | --- |
| `useTopicShiftDetection` | Keyword extraction, Jaccard/EMA tracking, raises `{ hasTopicShift, topicVersion }` | `src/features/writing/hooks/useTopicShiftDetection.ts`, `src/lib/topic.ts` |
| `useEditorText` | Controlled textarea value, cursor/focus, derived metrics | `src/features/writing/hooks/useEditorText.ts` (WIP) |
| `useSentenceTracker` | Sentence tokenization, measurement caching (`measureSentencePositions`) | `src/features/writing/hooks/useSentenceTracker.ts` + `src/lib/sentences.ts` |
| `useProdTriggers` | Debounce + watchdog timers, heuristics (`shouldTriggerProd`) | `src/features/prods/hooks/useProdTriggers.ts` + `src/lib/prodTriggerRules.ts` |
| Visualization | `ChipOverlay`, `HighlightOverlay`, `ThemeOverlay` read shared sentence data to stay aligned | `src/components/ChipOverlay.tsx`, `src/components/highlight/*` |

Observability hooks (e.g., logging, debug counters) should subscribe at the provider level instead of re-implementing inside each hook. Timer and debounce durations should always come from `useTimingConfig()` to keep `/demo` vs `/write` in sync.

## Prods System

- `ProdsProvider` wraps the editor stack on `/write` and `/demo`, keeps `{ prods, queueState, pinnedIds, filteredSentences }`, and wires `useProdActions()` (enqueue, pin, remove, notifyTopicShift, updateTopicContext). `queueState` now reflects multiple concurrent `processing` entries so the UI can show “2 in flight” instead of a binary “busy” flag.
- `useProdQueueManager` enforces the cadence guardrails: TTL dedupe maps, queue rate limiting, request cancellation, topic-version staleness checks, keyword forwarding, and the cached sentence list that backs embeddings and telemetry. Instead of single-flight processing, the manager backfills as many slots as the current parallel cap allows (2 prod / 3 demo) to shrink worst-case wait time.
- `/api/prod` now defaults to `gpt-5-mini` (configurable via `OPENAI_PROD_MODEL`) so each slot completes faster; softer model output is balanced by stricter dedupe and minimum confidence thresholds.
- Chip layout stays in `src/lib/chips/chipLayout.ts` so the provider only exposes logical positions (sentence id, offsets, max width). Chip overlays just render the placements they receive.
- `docs/diagrams/prod-queue.mmd` captures the queue transitions (initial, pending request, fulfilled, pinned, dropped).

- Normalized text dedupe uses `recentSentenceTextMapRef` (≈10s in `/write`, ≈30–120s in `/demo`). Similarity dedupe uses `sentenceFingerprintsRef` (≈15s in `/write`, ≈60s in `/demo`). Hooks must pass normalized text + fingerprints for the guardrail to work.
- `notifyTopicShift()` cancels all inflight requests, clears queue state + TTL maps, and increments the topic version so stale promises never promote a prod.
- Each queue item records `topicVersion` and is discarded if the current version changed before the API response resolves.
- Rate limiting (`waitForRateLimit(config.rateLimitMs)`) and queue pruning (3 items in `/write`, 5 in `/demo`) prevent runaway bursts; after pruning we launch as many items as the parallel cap allows so users see chips sooner even while some calls linger near the 15 s timeout.
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

## Cadence & Topic Guardrails

See `specs/[review] prod-cadence-and-topic.md` for the investigation narrative that led to the current guardrails. The architecture snapshot above ties that spec to concrete hooks:

1. **Topic Tracking**
	- `useTopicShiftDetection` extracts keywords from the most recent text window, runs Jaccard/EMA smoothing, and increments `topicVersion` whenever overlap falls below the configured threshold.
	- `TextInput` forwards `{ keywords, version }` via `updateTopicContext` so `useProdQueueManager` can enrich prompt payloads and stamp each queue item with the correct topic version.
	- The same hook flips `hasTopicShift`, which triggers `notifyTopicShift()` to cancel inflight requests, drop pending items, and clear dedupe caches before new topics queue more chips.
2. **Trigger Heuristics**
	- `useProdTriggers` is the only place that transforms `{ text, sentences, config }` into `enqueueSentence` calls. It covers punctuation heuristics, the character-count fallback, settling timers, and the six-second watchdog that raises a `force` prod if the writer pauses mid-thought.
	- After the watchdog fires we lock new triggers until the user types again so we don’t keep seeding the queue while the user is idle.
3. **Queue Gating**
	- `enqueueSentence` runs layered suppression: `shouldProcessSentence` filters low-signal sentences, normalized text + fingerprint TTLs block near-duplicates, and we skip items already in the queue, already pinned, or recently rendered.
	- Accepted items store `{ topicVersion, timestamp, force? }`. `processSingleItem` respects `config.rateLimitMs`, includes `recentProds.slice(-5)` plus the latest `topicKeywords` in the API payload, and aborts requests whenever the topic version changes. Once a slot frees up we immediately start the next pending item so a backlog drains in parallel.
	- Responses go through another guardrail: the queue drops low-confidence results (≤0.5 in `/write`, ≤0.05 in `/demo`), requires non-empty `selectedProd`, and only then appends to `prods[]` while pruning non-pinned items beyond the newest suggestion.
4. **Resets & Telemetry Prep**
	- `handleTopicShift` cancels in-flight requests, clears pending queue items, and wipes dedupe maps while leaving existing chips/pins intact. `clearAll` layers on a prod reset for demo refreshes.
	- `filteredSentences` caches the vetted sentences for embeddings so telemetry uses the exact pool the prod guardrails approved.
