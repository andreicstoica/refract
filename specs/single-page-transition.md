# Single-Page Transition — Spec (Writing + Themes)

## Goal

Eliminate the hard page transition between Write and Themes by introducing a single route that keeps users in flow. Start the embeddings/theme analysis automatically 20 seconds before the timer ends and gently reveal themes within the same page when results are ready.

## Summary

- New route: `src/app/writing-combined/page.tsx`.
- Keep the existing writing experience (TextInput, chips/prods, timer).
- Remove nav and explicit Analyze tab/button in this route.
- Auto-start analysis 20 seconds before timer end.
- No layout shift: highlights appear as an overlay on the existing writing surface.
- Animate the ThemeToggleButtons above the written text with a smooth and gentle entry animation; fade in highlights.
- Reuse existing lib/hooks/services functions and files: `useGenerateEmbeddings`, `storage`, highlight components.
- No visible analyzing UI: do not show spinners/banners; results simply appear when ready. (Optional: console.log for debugging.)

## Scope

- Client-only page that composes existing primitives:
  - `TextInput` for writing and prod chips
  - `WritingTimer` for countdown
  - `useGenerateEmbeddings` to kick off analysis (ensure color/label enrichment step is included as in current flow)
  - Inline theme UI as an overlay: render `ThemeToggleButtons` and a highlight paint layer on top of the existing `TextInput` area (no separate layout block)
  - Factor out a minimal `HighlightLayer` (from `TextWithHighlights`) that only paints ranges; mount it within the `TextInput` container.
  - Keep Option A (`ThemeHighlightView`) as a fallback path, but do not use it in this combined route to avoid layout shift.
  - Expose the textarea scroll/metrics needed for alignment (via ref or callback) without altering the writing UX.
- Minor enhancement to `WritingTimer` to notify when a threshold (e.g., 20s) is crossed, resilient to pause/resume.
- No API/backend changes expected; reuse `/api/embeddings`.

## UX

- Layout: same centered column as Write page (max-w-2xl), full-height canvas.
- Header: none (no `AppNav`). Only timer floats at top center.
- Writing: identical to current Write page — same `TextInput`, prods/chips, caret behavior, scroll lock, etc.
- Analysis trigger: happens automatically 20s before timer completes. No explicit button.
- Results: theme buttons fade/slide in; text highlights available without leaving the page.
- Completion: when timer reaches 0, themes are expected to be ready or soon after; if still running, keep loading until themes arrive.

## Data Flow

- Capture writing state from `TextInput` using `onTextUpdate(text, sentences, positions)` to keep:
  - `currentText: string`
  - `currentSentences: Sentence[]`
  - `currentPositions: SentencePosition[]` (used for prod/chip placement; not required for themes)
- When the pre-finish threshold is reached (T-20s):
  - Clear stale storage: `storage.clear()`; set `localStorage.setItem("refract-analysis", "running")`.
  - Call `useGenerateEmbeddings().generate(currentSentences, currentText)`.
  - `useGenerateEmbeddings` persists `themes`, `text`, `sentences` and clears the `refract-analysis` flag on completion.
- Display results inline by reading from returned themes or by polling storage like the Themes page fallback (only if needed).

## Timer Behavior

Problem: A naive `setTimeout(minutes*60 - 20)` won’t respect pause/resume.

Change: extend `WritingTimer` with a threshold callback that fires once when `timeLeft <= thresholdSeconds`, regardless of pauses/resumes.

Proposed API changes to `WritingTimer`:

- New optional props:
  - `onThreshold?: (secondsLeft: number) => void`
  - `thresholdSeconds?: number` (default 20)
- Semantics:
  - Internally track if threshold has fired; on every tick, if `timeLeft <= thresholdSeconds` and not fired, invoke `onThreshold(timeLeft)` once.
  - Works across pause/resume; doesn’t double-fire after completion.

This avoids duplicated timer logic in the page and simplifies reliability.

## Inline Themes UI

- Option A: mount `ThemeHighlightView` as a separate block under the timer.
  - Tradeoff: causes layout shift because the themes view inserts a new block below the writing surface.
- Option B (overlay): render highlights as a layer over the existing writing surface with no reflow.

Decision: choose Option B to avoid layout shift and make highlights “magically” appear over what was just written.

Overlay details (no layout shift):

- Wrap the textarea in a `relative` container (already true in `TextInput`).
- Add `HighlightLayer` as `absolute inset-0 pointer-events-none` within that container.
- Keep the textarea above the highlight layer with a transparent background so highlights show through; preserve identical `font`, `line-height`, `padding`, and `white-space: pre-wrap` for perfect alignment.
- Sync scroll: either share the scroll container or mirror `scrollTop` onto the paint layer.
- Z-index: ensure `ChipOverlay` remains above text; place `HighlightLayer` beneath chips. Optionally dim chips while theme buttons are focused.
- No analyzing indicator: do not change layout or show loading; only reveal theme controls/highlights once data exists.

Animation guidelines:

- No visible loading UI. Keep the page visually stable while analysis runs.
- When `themes.length > 0`: animate in the theme chips row (`opacity 0→1`, `y -8→0`, 250–350ms).
- Fade in the `HighlightLayer` from `opacity 0→1`; respect reduced motion by disabling translate.

## Page Structure (pseudo)

```
<div className="flex flex-col h-dvh overflow-hidden bg-background text-foreground">
  <div className="flex justify-center pt-4">
    <WritingTimer
      initialMinutes={timerMinutes}
      onTimerComplete={handleComplete}
      onThreshold={handlePreFinish}
      thresholdSeconds={20}
    />
  </div>

  <div className="flex-1 min-h-0">
    {/* The TextInput provides a relative container around the textarea */}
    <TextInput onTextUpdate={handleTextUpdate} />

    {/* Overlay area colocated with TextInput’s relative container */}
    {themesReady && (
      <>
        <ThemeToggleButtons ... />
        <HighlightLayer ranges={ranges} text={currentText} />
      </>
    )}
  </div>
</div>
```

Notes:

- Zero layout shift: highlights are painted as an overlay within the existing writing container.
- Ensure highlight paint aligns with text metrics and scroll position; chips remain visible and move accordingly.
- Do not show any loading UI; themes and highlights simply appear when ready.

## Error Handling

- If analysis fails, surface a non-blocking toast with a “Retry analysis” action that calls `generate(currentSentences, currentText)` again.
- If `currentSentences.length === 0` at threshold time, defer analysis until at least one sentence exists; re-check every few seconds.
- If results don’t arrive within 40s, show a soft failure message and keep the page usable.

## Telemetry

- Log time from `onThreshold` fired to themes available.
- Count retries due to failure or empty-sentences deferral.
- Track whether results were ready before the timer finished.

## Accessibility

- Maintain focus in the textarea; avoid stealing focus when themes load.
- Ensure theme buttons are keyboard accessible; `aria-pressed` mirrors selection.
- Respect reduced motion: disable slide animations and prefer fade-only.

## Milestones

Note: 👉 = currently in progress, ✅ = completed, no emoji = up next.

1. ✅ Spec finalized and overlay choice

- Finalize combined route goals, choose overlay (no layout shift), remove visible loading from UX.
- Acceptance: spec reflects overlay approach, zero-loading requirement, and consolidated milestones.

2. 👉 Route + Shell scaffold

- Create `src/app/writing-combined/page.tsx` without nav; include `IntroModal`, `WritingTimer`, and `TextInput`. Maintain body scroll-lock parity with `/write`.
- Acceptance: page renders; typing works; timer counts down; no console errors.

3. Timer threshold API

- Add `onThreshold` and `thresholdSeconds` (default 20) to `WritingTimer`; fire once when `timeLeft <= thresholdSeconds`, resilient to pause/resume.
- Acceptance: single threshold event observed across pause/resume (via console); no double fires.

4. Background analysis wiring (silent)

- At T-20: `storage.clear()`, set `refract-analysis=running`, call `generate(sentences, text)`; do not show any loading UI.
- Acceptance: on completion, storage has `themes/text/sentences`; `refract-analysis` cleared; no visible UI during generation.

5. Overlay highlight infrastructure

- Extract `HighlightLayer` (paint-only) from `TextWithHighlights`. Mount as `absolute inset-0 pointer-events-none` inside `TextInput`’s relative container; align font, line-height, padding, white-space.
- Adjust `TextInput` for transparent textarea background (scoped to this route) and provide scroll metrics/ref if needed. Ensure `ChipOverlay` remains above highlights.
- Acceptance: highlight layer aligns with text metrics and scroll; no input regression; chips render above highlights.

6. Overlay reveal (no loading UI)

- When themes are available: animate in `ThemeToggleButtons` and fade in `HighlightLayer`; respect reduced motion. No layout reflow.
- Acceptance: zero reflow on reveal; highlights precisely align with existing text; no visible loaders; no console errors.

7. Edge cases and failure handling

- Guard empty-sentences start (defer trigger until at least one sentence); basic retry/backoff on errors.
- Acceptance: resilient behavior under missing data or transient failures; no crashes; clear console diagnostics.

8. Accessibility and reduced motion

- Keep focus in textarea; keyboard-accessible theme buttons (`aria-pressed`); disable translate animations for reduced motion.
- Acceptance: passes manual a11y checks; motion reduced appropriately.

9. Telemetry and diagnostics (stealth)

- Only console.log diagnostic timestamps for threshold start/finish; no in-UI indicators.
- Acceptance: useful logs without UI changes; easy to toggle off for production.

10. Rollout and QA

- Keep `/write` and `/themes` intact; add `/writing-combined` for evaluation; smoke test across devices.
- Acceptance: build/lint pass; no console errors; feature ready for user testing.

## Open Questions

- Should we auto-select the top theme on reveal, or require user selection? (Recommend none selected by default.)
- While themes are shown, should we slightly compress the textarea padding to prioritize controls? (Optional.)
- Persist in-progress text more frequently to reduce data loss on reload? (Out of scope here.)

## Rollout

- Keep `/write` and `/themes` unchanged.
- Introduce `/writing-combined` behind no flag; accessible directly for evaluation.
- If successful, plan deprecation of nav/analyze in the combined experience only.

## Implementation Notes (code references)

- Start/stop analysis as done in `/write` → `/themes` flow:
  - `useGenerateEmbeddings` — saves to `storage` and clears `refract-analysis`.
  - `storage` — `setThemes`, `setText`, `setSentences`, `clear`.
  - `ThemeHighlightView` — renders theme chips + highlighted text.
- Reuse `IntroModal` for setting timer minutes; same interaction as Write.
- Maintain body scroll lock as in `src/app/write/page.tsx`.

## UI Stealth Behavior (No Loading Indicator)

- During analysis (from threshold trigger until themes available), do not display banners/spinners/skeletons.
- Keep caret, chips, and typing uninterrupted; no layout changes.
- Optional: log to console for debugging (e.g., `console.log('analysis: started/completed')`).
