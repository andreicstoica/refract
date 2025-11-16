# Mobile Fixes Spec

- Owner: Frontend
- Target: Next.js App (React 19), Tailwind, TypeScript
- Scope: Improve mobile Safari (iOS) usability and performance for chips/highlights and the text editor area.
- Out of scope: Visual redesign, feature changes unrelated to scrolling, caret behavior, or chip layout.

## Goals

- Smooth, consistent scroll performance at 60fps+ on iOS Safari.
- Ensure the caret is never obscured by the on-screen keyboard while typing.
- Keep chips fully visible within the text area with reliable insets/gutters.

## Affected Areas

- Components: `src/components/*` that render editor/contenteditable and chip/highlight UIs (e.g., `Editor`, `ChipList`, `Highlights`).
- Styles: `src/index.css` and any co-located component styles.
- Utilities/hooks: additions under `src/lib/` and `src/hooks/`.

---

## Issue 1: Jelly/Delayed Scrolling of Chips and Highlights (iOS Safari)

### Symptoms

- Vertical scroll feels elastic/jelly with delayed re-position of chips/highlights compared to desktop.
- Noticeable jank when scrolling fast; UI updates trail the scroll position.

### Likely Root Causes

- Main-thread work on `scroll` events (chip/highlight positioning, measurements) causing layout thrash.
- Non-passive listeners or `preventDefault` on touch/scroll that blocks composited scrolling.
- Frequent `getBoundingClientRect`/layout reads after DOM writes within the same frame.
- Overuse of non-composited properties (e.g., `top/left`) for moving elements instead of transforms.
- Containers missing isolation (`contain`), causing large invalidation areas.

### Decisions

- Make all scroll/touch listeners passive where interaction doesn’t require cancellation.
- Throttle main-thread visual updates to `requestAnimationFrame` and minimize layout reads.
- Prefer GPU-friendly transforms (`translate3d`) or CSS sticky for chip/highlight positioning.
- Add `contain` and `will-change` selectively to reduce paint/layout scope.
- Ensure scroll containers use momentum scrolling appropriately; avoid unnecessary nested scrollers.

### Implementation Notes

- Event listeners: use `{ passive: true }` for `touchstart/touchmove/wheel/scroll` when not canceling.
- rAF loop: accumulate last known scroll position; update dependent visuals once per frame.
- Replace `top/left` updates with `transform: translate3d(...)` where possible.
- Use `position: sticky` for headers/anchors instead of JS.
- Add CSS isolation on heavy containers: `contain: layout paint size;` (or `content`), and apply `will-change: transform` only where movement is guaranteed.
- Avoid synchronous measurement after mutation; batch: read → rAF → write.
- Ensure scroll targets are the correct elements (minimize nested `overflow: auto` unless necessary).

### Acceptance Criteria

- Scrolling chips/highlights on iPhone (iOS 17/18) feels as smooth as desktop with no visible lag.
- Lighthouse/DevTools Performance (remote) shows < 4ms scripting on scroll frames and no forced reflow warnings.
- No blocking non-passive listener warnings in Safari’s Web Inspector.

### Testing Plan

- Manual: iPhone 13/14/15, iOS 17 and 18; fast flicks and slow drags.
- Remote profiling: Safari Web Inspector → Timelines while scrolling chips panel and main editor.
- Regression: Desktop Chrome/Safari behavior unchanged.

---

## Issue 2: Caret Hidden Under Mobile Keyboard

### Symptoms

- While typing long content, the caret falls beneath the iOS keyboard. Desktop autoscroll works; mobile does not.

### Root Causes (iOS specifics)

- iOS virtual keyboard reduces the visual viewport, but layout viewport remains larger; `vh` units and fixed containers don’t adapt.
- Containers with `height: 100vh` or fixed footers block autoscroll. iOS does not always auto-scroll contenteditable.
- Missing bottom safe-area/gutter to account for keyboard height; `scrollIntoView` not invoked during input.

### Decisions

- Adopt dynamic viewport units and safe-area support on iOS (`100dvh`, `env(safe-area-inset-bottom)`).
- Rely on the existing `keyboard-safe-bottom`/`scroll-keyboard-safe` utilities (which already respect `env(safe-area-inset-bottom)`) instead of introducing a new keyboard hook; revisit JS if future profiling shows gaps.
- Ensure the focused caret target scrolls into view during input/selection changes without fighting native scrolling.

### Implementation Notes

- Layout: replace `100vh` with `100dvh` where full-height containers are used; use explicit feature queries for progressive enhancement on older iOS:
  - `@supports (height: 100dvh) { .full-vh { height: 100dvh; } }`
  - `@supports not (height: 100dvh) { .full-vh { height: -webkit-fill-available; min-height: 100vh; } }`
- Safe area: add bottom padding for iOS using `padding-bottom: max(env(safe-area-inset-bottom), var(--kb-safe, 0px));` (the `.keyboard-safe-bottom` utility wires this together and will fall back to safe-area insets until we revisit JS-driven updates).
- Scroll logic: on `input`/`selectionchange`, if caret rect bottom > visual viewport bottom − threshold, call `element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` on the scrollable editor container.
- Avoid `preventDefault` on `touchmove` in the editor; it blocks native scroll adjustments.
- Add `scroll-margin-bottom` on editable content to `var(--kb-safe, 0px)` to ensure caret visibility.

### Acceptance Criteria

- While typing continuously at the end of the document, the caret is always visible above the keyboard on iOS Safari.
- No content jumpiness; scrolling is smooth and only minimal adjustments occur when caret nears the bottom.
- Desktop behavior is unchanged.

### Testing Plan

- Manual: type to the end of long content; rotate device; enter/exit split-screen (iPad) to validate dynamic viewport updates.
- Edge: composition input (IME), emoji keyboard, dictation, hardware keyboard attached.

---

## Issue 3: Chips Clipped at Left/Right Edges of Text Area

### Symptoms

- Chip UI appears slightly cut off on the left/right edges of the scrollable text area.

### Likely Causes

- Clipping by an `overflow: hidden` container without adequate inner padding/gutters.
- Chip max width equals container width without accounting for padding/border; `box-sizing` mismatch.
- Horizontal scroll-padding not set, causing scroll positions to align content flush with edges.

### Decisions

- Standardize inner gutters on the text area and chip rows.
- Ensure `box-sizing: border-box` and chip max width respects gutters.
- Add `scroll-padding-inline`/`scroll-margin-inline` to avoid edge clipping when scrolling to chips.

### Implementation Notes

- Container: add consistent `padding-inline` (e.g., Tailwind `px-3`/`px-4`) on the text area wrapper that clips children.
- Chips: ensure they use margins that respect the container gutter; use a responsive bound with `clamp()`:
  - `inline-size: clamp(8ch, calc(100% - 2 * var(--chip-gutter)), 100%);`
- Scrolling: set `scroll-padding-inline` (or Tailwind `scroll-px-*`) on the horizontal scroller to preserve inset.
- Double-check no negative margins/transforms push chips beyond the padding box.

### Acceptance Criteria

- No visual clipping of chips on either side at any zoom level.
- When horizontally scrolled, the first/last chip remain fully visible with a small inset (≥8px).

### Testing Plan

- Visual QA at multiple font scales (iOS Accessibility), RTL locale, and different chip lengths.

---

## Cross-Cutting Work

### New/Updated Utilities

- CSS utilities: `.keyboard-safe-bottom` / `.scroll-keyboard-safe` in `src/index.css` lean on `env(safe-area-inset-bottom)` (with `var(--kb-safe, 0px)` as a placeholder) so no new JS hook is required today.
- `src/lib/useRafScroll.ts`: rAF-based scroll handler helper to coalesce scroll work into a single per-frame callback.

### Style Updates

- `src/index.css`: add CSS variables and dynamic viewport fallbacks; safe-area padding usage.
- Component-level classes: add gutters (`px-*`, `scroll-px-*`), `scroll-margin-bottom`, and isolation (`contain`) on heavy containers.

### Progressive Enhancement (Older iOS)
- Dynamic viewport units with explicit feature queries:
  - `@supports (height: 100dvh) { .full-vh { height: 100dvh; } }`
  - `@supports not (height: 100dvh) { .full-vh { height: -webkit-fill-available; min-height: 100vh; } }`
- Keyboard overlap handling:
  - Favor the `.keyboard-safe-bottom`/`.scroll-keyboard-safe` helpers that read `env(safe-area-inset-bottom)` so we still get spacing without a dedicated JS hook; `var(--kb-safe, 0px)` stays as a placeholder for future dynamic updates.
  - Avoid fixed footers on compact height; favor `position: sticky`.

### Risks & Mitigations

- Over-application of `will-change` can increase memory usage → apply narrowly.
- Conflicts between native autoscroll and manual `scrollIntoView` → guard with visibility checks and debounce.
- Older iOS versions with partial `visualViewport` bugs → fallback to `100dvh` + safe-area only.

### Metrics & Verification

- Record scroll-frame times and scripting time via Safari Timelines before/after.
- Count forced reflow warnings; target zero during scroll.
- Dogfood on multiple devices for at least one day before release.

## Rollout Plan

- Implement behind a feature flag (e.g., `NEXT_PUBLIC_MOBILE_TWEAKS=1`) for quick rollback.
- Ship to staging; QA pass on iOS and Android.
- Monitor for regressions; remove flag after validation.

## Definition of Done

- All acceptance criteria above pass on iPhone 13/14/15 (iOS 17/18) and desktop Chrome/Safari.
- No new lint warnings; performance profiling meets targets.
- PR includes short video demos for each fix area and profiling screenshots.

---

## Milestones & Tickets

Note: Status markers — 👉 in progress, ✅ completed, no marker = pending.

Context notes (for implementers):
- Chips: `@/lib/chips/chipLayout.ts` drives `maxWidthPx` and offsets used by `@/components/ChipOverlay.tsx` and `@/components/Chip.tsx`.
- Highlights: scroll-sync already uses rAF in `@/components/highlight/HighlightOverlay.tsx` and `@/app/page.tsx`.
- Text input: core textarea lives in `@/components/TextInput.tsx`; text parsing in `@/hooks/useTextProcessing.ts`.
- Services: feature-level clients (`@/features/themes/services/embeddingsClient`, `@/features/prods/services/prodClient`) are not impacted; ensure no changes in API contracts.
- Constants: `@/lib/constants.ts` defines shared padding/text classes used by overlays; keep in sync.

1) 👉 M1 — Scroll Performance Hardening (iOS)
   - Ticket 1.1: Audit scroll/touch listeners and paints
     - Files: `src/components/highlight/HighlightOverlay.tsx`, `src/components/ChipOverlay.tsx`, `src/components/TextInput.tsx`, `src/components/ui/scroll-area.tsx`.
     - Actions: confirm passive listeners on `scroll/touch` (already passive in overlays); ensure no `preventDefault` on content scroll paths; verify rAF usage for scroll-sync; check for forced layouts in dev tools.
     - Acceptance: no non-passive listener warnings; no forced reflow during scroll in Safari Timelines.
   - Ticket 1.2: rAF scroll coalescing helper
     - Files: add `src/lib/useRafScroll.ts`; integrate in `TextInput.tsx` and overlay sync sites to standardize pattern.
     - Actions: expose `subscribe(element, handler)` that batches scroll callbacks to 1/frame using `requestAnimationFrame`.
     - Acceptance: profiling shows <4ms scripting on scroll frames; stable frame rate during fast flick.
   - Ticket 1.3: Compositing hints and isolation
     - Files: `src/index.css`, overlay containers in `HighlightOverlay.tsx` and `ChipOverlay.tsx`.
     - Actions: add `contain: content;` or `contain: layout paint size;` on heavy overlay containers; apply `will-change: transform` only on `data-*` translated content wrappers.
     - Acceptance: smaller paint invalidation regions in Safari Web Inspector; no regressions on desktop.

2) M2 — Keyboard-Safe Caret Visibility
   - Ticket 2.1: Keyboard safe-area CSS
     - Files: `src/index.css`, `src/components/TextInput.tsx`.
     - Actions: ensure `.keyboard-safe-bottom`/`.scroll-keyboard-safe` combine `env(safe-area-inset-bottom, 0px)` with `var(--kb-safe, 0px)` so caret spacing works even without JS; document why a dedicated keyboard hook is not part of this rollout.
     - Acceptance: CSS padding/margins keep the caret above the keyboard across iOS versions and we have a short note on why no JS hook is added.
   - Ticket 2.2: Apply safe-area + scroll padding
     - Files: `src/index.css`, `src/app/page.tsx`, `src/components/TextInput.tsx`.
     - Actions: ensure `padding-bottom` uses `max(env(safe-area-inset-bottom), var(--kb-safe, 0px))` and add `scroll-margin-bottom` with the same combo so `keyboard-safe-bottom` stays accurate even while `--kb-safe` is 0; eliminate `height: 100vh` blockers.
     - Acceptance: caret stays above keyboard while typing to end; no excessive jumps and the CSS docs mention the `var(--kb-safe)` placeholder.
   - Ticket 2.3: Caret auto-scroll on input
     - Files: `src/components/TextInput.tsx`.
     - Actions: on `input`/`selectionchange`, if caret is below `visualViewport.bottom - threshold`, call `scrollIntoView({ block: 'nearest' })` on the scrollable container.
     - Acceptance: consistent caret visibility on iOS 17/18; desktop unchanged.

3) M3 — Chip Edge-Clipping Fix
   - Ticket 3.1: Establish gutters and clamp sizing
     - Files: `src/components/Chip.tsx`, `src/components/ChipOverlay.tsx`, `src/index.css`.
     - Actions: ensure overlay content wrapper mirrors textarea padding; introduce `--chip-gutter` and apply `inline-size: clamp(8ch, calc(100% - 2 * var(--chip-gutter)), 100%)` to chip container (coexist with `maxWidthPx` from layout to guarantee clamp to boundaries).
     - Acceptance: first/last chips show ≥8px inset; no clipping at edges.
   - Ticket 3.2: Scroll padding on horizontal chip scrollers
     - Files: `src/components/highlight/ThemeToggleButtons.tsx` (chip toggles area), any horizontal chip lists.
     - Actions: add `scroll-padding-inline` (Tailwind `scroll-px-*`) to preserve inline inset when scrolling to edges.
     - Acceptance: horizontal scroll stops with insets; chips fully visible.

4) M4 — Dynamic Viewport Fallbacks (Older iOS)
   - Ticket 4.1: Feature-query classes for dvh
     - Files: `src/index.css`.
     - Actions: add `@supports (height: 100dvh)`/`not` blocks with `.full-vh` utility; prefer `h-dvh` where available, fallback to `-webkit-fill-available`/`100vh`.
     - Acceptance: page height adapts correctly on older Safari; no letterboxing when keyboard opens.
   - Ticket 4.2: Replace direct `100vh` usage
     - Files: `src/app/page.tsx`.
     - Actions: replace `document.body.style.height = "100vh"` with class-based `.full-vh` or `100dvh` approach and avoid locking layout viewport.
     - Acceptance: no caret obscuring due to viewport lock; no layout jumps on rotate.

5) M5 — QA, Profiling, and Rollout
   - Ticket 5.1: Device QA and profiling
     - Devices: iPhone 13/14/15 on iOS 17/18; iPadOS split view.
     - Actions: record Timelines before/after; verify no forced reflows; capture videos for PR.
   - Ticket 5.2: Feature flag + staging
     - Files: `next.config.ts`, `.env` docs, usage gates around new behaviors.
     - Actions: gate with `NEXT_PUBLIC_MOBILE_TWEAKS`; deploy to staging; smoke test Android as well.
