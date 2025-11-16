# AppNav + Timer Refactor — Spec

## Goal

- Implement a new `AppNav` component that replaces the current writing nav elements and relocates timer actions into a contextual nav control.
- Support two primary tabs: Write (default) and Reflect, using an Origin UI Tabs variant with icons and badges.
- Move Skip/Reflect/Reflecting out of `WritingTimer` into `AppNav`.
- Navigate to Reflect immediately on Reflect action; Reflect shows a loading state until themes are ready.

## Why (Current → Proposed)

- Current
  - `WritingNav` owns `IntroModal` and floats `WritingTimer` with an inline Skip/Analyze/Analyzing control.
  - Reflect action currently awaits embeddings then navigates to `/themes`.
  - Reflect lacks a first-class “loading while analyzing” state.
- Proposed
  - New `AppNav` (tabs + contextual action) becomes the consistent, sticky top nav across Write/Reflect.
  - `WritingTimer` focuses on time display/controls only; no navigation/actions.
  - Reflect action triggers background generation and navigates immediately to the Reflect page with a clear loading UI.

## Components

### AppNav (new)

- Location: `src/components/AppNav.tsx`
- Built with Origin UI Tabs patterns from `src/components/comp-433.tsx` and `@/components/ui/tabs` + `Badge`.
- Props
  - `active: "write" | "reflect"`
  - `onTabChange?: (tab: "write" | "reflect") => void`
  - `contextAction?: {
  state: "hidden" | "skip" | "reflect" | "reflecting";
  onSkip?: () => void;
  onReflect?: () => void;
}`
  - `badges?: {
  reflectCount?: number;
  reflectIsNew?: boolean;
}`
  - `className?: string`
- Behavior
  - Left: `TabsList` with two `TabsTrigger`s
    - Write: `PencilLine` icon
    - Reflect: `Binoculars` icon, badge shows theme count or a subtle “New/…” indicator
  - Right: contextual button (Skip | Reflect | Reflecting… | hidden)
  - Emits `onTabChange` on tab click; parent performs routing
- A11y: labeled tabs, button `aria-busy` when analyzing

### WritingTimer (refactor)

- Location: `src/components/WritingTimer.tsx`
- Remove Skip/Done/Reflect button block and related props (`onFastForward`, `onDone`).
- Keep: play/pause, display, progress, `onTimerComplete`.
- No navigation responsibility; write page owns threshold/analysis state.

### IntroModal (renamed from TimerSetupModal)

- Continues to collect minutes and start the session.

## UX Overview

- Top bar: sticky, translucent, subtle border/blur; uses Tabs for Write/Reflect
- Contextual action on the right:
  - Before threshold: hidden
  - After 20s threshold: “Skip” (optional path to end session early)
  - After timer complete: “Reflect” (navigates and triggers analysis)
  - While analysis running: disabled “Reflect” with spinner (state: Reflecting) and badge on the Reflect tab
- Timer: positioned directly under nav on Write page

## State & Flow

### Write Page (`src/app/write/page.tsx`)

- State
  - `timerStarted: boolean`
  - `thresholdReached: boolean` (becomes true 20s after timer start)
  - `timerCompleted: boolean` (set by `onTimerComplete`)
  - `isGenerating: boolean` (from `useGenerateEmbeddings`)
  - Text, sentences, positions (existing)
    // Derived nav `contextAction.state`
  - `hidden` (pre-threshold and not completed)
  - `skip` (thresholdReached && !timerCompleted && !isGenerating)
  - `reflect` (timerCompleted && !isGenerating)
  - `reflecting` (isGenerating)
- Analyze behavior
  - Set `localStorage.setItem("refract-analysis", "running")`
  - Fire `generateEmbeddings(sentences, text)` without awaiting
  - `router.push("/themes")` immediately
  - On completion inside hook: write themes/text/sentences to storage and set `refract-analysis = done` or remove the key

### Reflect Page (`src/app/themes/page.tsx`)

- On mount
  - If themes exist: render immediately; Reflect badge shows count
  - If no themes and `refract-analysis === running`: show loading state and poll every 500ms for `storage.getThemes()`; when present, render and clear the key
- Loading UI
  - Centered “Analyzing your writing…” status
  - Skeleton placeholders for bubbles/highlights area

## Routing

- Tabs are presentational; pages control `active` and navigation
  - Write: `active="write"`; onTabChange(`reflect`) → `router.push("/themes")`
  - Reflect: `active="reflect"`; onTabChange(`write`) → `router.push("/write")`

## Migration Plan

1. Add `AppNav.tsx` with tabs, icons, badges, and contextual action.
2. Refactor `WritingTimer.tsx`: remove Skip/Analyze UI and props; keep timer core.
3. Update `src/app/write/page.tsx`:
   - Remove `WritingNav`; show `AppNav` at top and render `IntroModal` + `WritingTimer` below
   - Manage `thresholdReached` via `setTimeout` after timer start (20s)
   - Derive `contextAction` from states
   - Implement `onReflect` to set `refract-analysis`, kick off embeddings (no await), and navigate to `/themes`
4. Update `src/app/themes/page.tsx` with loading state that watches `refract-analysis` and storage
5. Optional: deprecate `WritingNav.tsx` (leave for now or remove after references are gone)

## Pseudo Code

### AppNav usage on Write

```tsx
<AppNav
  active="write"
  onTabChange={(t) => t === "reflect" && router.push("/themes")}
  contextAction={{
    state: isGenerating
      ? "reflecting"
      : timerCompleted
      ? "reflect"
      : thresholdReached
      ? "skip"
      : "hidden",
    onSkip: endSessionEarly,
    onReflect: reflectAndGo,
  }}
  badges={{
    reflectCount: themesCountFromStorage,
    reflectIsNew: isGenerating,
  }}
/>
```

### Reflect and go

```ts
function reflectAndGo() {
  localStorage.setItem("refract-analysis", "running");
  generateEmbeddings(currentSentences, currentText); // fire and navigate
  router.push("/themes");
}
```

## Acceptance Criteria

- New `AppNav` renders on Write and Reflect with icons, badges, and a contextual action.
- Skip/Reflect/Reflecting is exclusively in the nav; `WritingTimer` has no action buttons.
- Clicking Reflect transitions immediately to the Reflect page and shows a page-level loading state until themes load.
- Reflect badge shows a theme count when available; “New/…” badge appears while analyzing.
- Mobile layout remains clean; nav is sticky; timer is centered under nav.

## Data Contracts

- Existing storage keys: `refract-themes`, `refract-text`, `refract-sentences`
- New key: `refract-analysis` = `running | done` (remove when done)

## Out of Scope

- Additional tabs or generic tab framework
- Server persistence
- Global state library (use localStorage for now)

## Notes

- Use `PenLine` and `Brain` from `lucide-react`.
- Follow Tailwind + Origin UI class patterns from `comp-433.tsx`.
- Keep props typed with strict TypeScript and `@/` imports.
