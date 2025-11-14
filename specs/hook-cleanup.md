# Hook Cleanup Plan

## Goals
- Present a review-ready state flow by reducing redundant hooks and centralizing side effects.
- Keep React hooks only where lifecycle/state is required; push pure helpers into `src/lib/` or `src/services/`.
- Share timing/configuration concerns across `/write` and `/demo` so the prod queue, text processing, and theming read from the same source of truth.
- Remove the temporary mobile ergonomics hooks (`useViewportKeyboard*`, `useModalKeyboard`, `usePageScrollLock`) to shrink complexity while focusing on the storytelling flow outlined in `src/app/demo/page.tsx` and `src/app/write/page.tsx`.

## Current Flow Snapshot
1. **Timer intro** – `IntroModal` (`src/components/IntroModal.tsx`) collects minutes and currently uses `useModalKeyboard` for shortcuts.
2. **Writer surfaces** – `/write` and `/demo` render `TextInput`, which wires `useTextProcessing`, `useTopicShiftDetection`, and `useProds` together alongside scroll helpers (`useRafScroll`, `useViewportKeyboardCSSVar`, `usePageScrollLock`).
3. **Prod generation** – `useProds` (`src/features/prods/hooks/useProds.ts`) owns prod data, reducer-driven queue management, rate limiting, dedupe fingerprints, pinning, and topic-shift resets in a single hook consumed only by `TextInput`.
4. **Theme analysis** – `useEmbeddings` context plus `HighlightOverlay` produce/visualize embeddings once `WritingTimer` reaches thresholds. Theme toggles live in page components.

Problems surfaced during review:
- `useTextProcessing` owns the textarea ref, timers, sentence splitting, layout hints, and directly triggers prods. `TextInput` separately stores `currentText` purely for topic detection, creating duplicate state.
- `useProds` mixes reducer logic with UI convenience (pinned IDs, filtered sentences) and is tightly coupled to `useDemoMode`, making it hard to reuse or reset at session boundaries.
- Timing config is derived independently in both `useProds` and `useTextProcessing`, so “demo mode” tweaks can drift.
- Mobile ergonomics hooks (keyboard safe-area, modal hotkeys, page scroll lock) add complexity even though the primary review story focuses on desktop interactions.

## Proposed Architecture

### 1. TimingConfigProvider
- Add `src/features/config/TimingConfigProvider.tsx` that detects demo mode once (`usePathname` under the hood) and memoizes `getTimingConfig`.
- Context interface:

```ts
interface TimingConfigContext {
	isDemoMode: boolean;
	config: ReturnType<typeof getTimingConfig>;
}

export const TimingConfigProvider: React.FC<{ children: React.ReactNode }>; // wraps `root` layout
export function useTimingConfig(): TimingConfigContext;
```

- `app/layout.tsx` (and `app/demo/layout.tsx` if split later) wraps children with this provider so every consumer shares the same config object.
- Remove direct `useDemoMode` calls from `useTextProcessing` and `useProds`; inject the config through the new hook.

### 2. Editor Text Pipeline
Split the current `useTextProcessing` responsibilities into composable hooks/utilities that `TextInput` can stitch together without introducing a monolithic “journal” hook:

1. **`useEditorText` (hook)**
	- Owns `text`, `textareaRef`, focus-on-mount, auto-scroll-to-bottom, and exposes `handleChange`.
	- Calls an optional `onTextChange` callback the same way the current hook does.
	- Returns `{ text, setText, textareaRef, handleChange, metrics: { lineCount, ... } }`.

2. **`useSentenceTracker` (hook + utilities)**
	- Consumes `{ text, textareaRef }`.
	- Uses pure helpers in `src/lib/sentences` for splitting/position measurement and caches positions through `measureSentencePositions`.
	- Exposes `{ sentences, positions, refreshPositions }` so `ChipOverlay`/`HighlightOverlay` keep working.

3. **`useProdTriggers` (hook)**
	- Accepts `{ text, sentences, onTrigger, config, prodsEnabled }`.
	- Houses timers (debounce, settling timer, watchdog) and the existing trigger heuristics (`shouldTriggerProd`), but the heuristics themselves move to `src/lib/prodTriggerRules.ts` so they’re testable without React.
	- No longer returns layout info; it purely emits triggers.

4. **Topic detection integration**
	- `useTopicShiftDetection` consumes the `text` returned from `useEditorText` directly, dropping the duplicate `currentText` state in `TextInput`.
	- When `hasTopicShift` flips, `TextInput` calls into the new `ProdsProvider` action `notifyTopicShift()` instead of invoking a hook-level handler.

With this split, `TextInput` roughly becomes:

```ts
const editor = useEditorText({ onTextChange });
const tracker = useSentenceTracker({ text: editor.text, textareaRef: editor.textareaRef });
useProdTriggers({
	text: editor.text,
	sentences: tracker.sentences,
	onTrigger: prodActions.enqueue,
	config: timing.config,
	prodsEnabled,
});
```

### 3. ProdsProvider + Queue Manager
- Create `src/features/prods/context/ProdsProvider.tsx` that wraps the writing surfaces.
- Inside, use two custom hooks:
	1. `useProdQueueManager` – encapsulates the reducer, rate limiting, request cancellation, dedupe fingerprints, and topic-version gating (most of the current `useProds`).
	2. `useProdDisplayState` – derives `visibleProds`, `pinnedIds`, and `filteredSentences` from the queue + prod list.
- Expose two context hooks so consumers opt into only what they need:

```ts
interface ProdState {
	prods: Prod[];
	queue: QueueState;
	pinnedIds: Set<string>;
	filteredSentences: Sentence[];
}

interface ProdActions {
	enqueueSentence(args: { sentence: Sentence; fullText: string; force?: boolean }): void;
	injectProd(args: { sentence: Sentence; fullText: string; text: string }): void;
	pin(id: string): void;
	remove(id: string): void;
	notifyTopicShift(): void;
	clearAll(): void;
}

const ProdsProvider: React.FC<{ children: React.ReactNode }>; // uses `useTimingConfig` internally
function useProdState(): ProdState;
function useProdActions(): ProdActions;
```

- `TextInput` replaces its `useProds` call with these hooks; `ChipOverlay` receives `prods`/`pinnedIds` from context instead of props drilling.
- Topic versioning: `useTopicShiftDetection` increments a version number; `ProdsProvider` stores that version and compares it against queued requests (similar to today’s `latestTopicVersionRef`).

### 4. Theme Analysis + Highlight Hooks
- Keep `EmbeddingsProvider` for the async call boundary but extend its API to optionally accept a `sessionId` so results can be discarded if the user resets.
- Introduce a lightweight `useThemeAnalysis` hook in `src/features/themes/hooks/useThemeAnalysis.ts` that:
	- Watches `sentences`/`text` (from the tracker) and `WritingTimer` events to kick off embeddings at the appropriate time.
	- Stores `themes`, `selectedThemeIds`, and exposes `toggleTheme` + `rerunAnalysis` functions.
- `HighlightOverlay` already consumes `rangesFromThemes`; no change other than reading from the new hook/context instead of page-level state.

### 5. Timer + Session Boundaries
- Keep timer state local to the page, but give `ProdsProvider` and `useThemeAnalysis` a `resetSession()` method that clears all derived state when the intro modal reopens or when the user refreshes.
- Expose a single “session context” (could be simple `useState` in the page) that holds `sessionId`. Pass it down to `ProdsProvider`, `useThemeAnalysis`, and `useProdTriggers` so each system can disregard stale async work if the user restarts quickly.

### 6. Remove Mobile Ergonomics Hooks
- Delete `useViewportKeyboard.ts` and stop calling `useViewportKeyboardCSSVar` in `/demo` and `/write`. Replace with simple CSS (`keyboard-safe-bottom` already exists) or rely on `env(safe-area-inset-bottom)` for now.
- Remove `usePageScrollLock`; allow the page to scroll normally, which also simplifies hydration concerns.
- Remove `useModalKeyboard`; fall back to default form inputs and native keyboard navigation in `IntroModal`. If arrow-key increments are required, wire them directly inside the component using `onKeyDown` scoped to the relevant input rather than a document-level hook.
- Keep `useRafScroll` because it serves the visible overlay sync and is already a clear utility hook.

### 7. Hook vs Utility Guidelines
- Pure logic (trigger heuristics, dedupe helpers, highlight calculations) belongs in `src/lib/` or `src/services/` so it can be unit-tested without React.
- Hooks should expose a minimal API: either “state only” (`useProdState`) or “actions only” (`useProdActions`), or small objects containing only what a caller truly needs.
- When a hook orchestrates multiple effects (e.g., `useProdTriggers`), accept explicit dependencies instead of reaching into other contexts to keep coupling obvious.

## Implementation Steps
1. ✅ **Prep & Mobile Cleanup**
	- Remove imports/usages of `useViewportKeyboardCSSVar`, `useViewportKeyboard`, `usePageScrollLock`, and `useModalKeyboard`.
	- Delete the hook files and update `IntroModal`, `/demo`, `/write`, and `specs/mobile-fixes.md` to reflect the simplified behavior.

2. ✅ **Timing Config Provider**
	- Create `TimingConfigProvider`, wrap `src/app/layout.tsx`, update `/demo` (or `app/demo/layout.tsx`) if needed.
	- Replace `useDemoMode` usages in `useTextProcessing` and `useProds` with `useTimingConfig`.

3. ✅ **Editor Hook Split**
	- Implement `useEditorText`, `useSentenceTracker`, and `useProdTriggers` under `src/features/writing/hooks/`.
	- Move shared logic (trigger heuristics, layout calculations) into new helpers under `src/lib/`.
	- Update `TextInput` to use the new hooks and feed `text` directly into `useTopicShiftDetection`.

4. ✅ **ProdsProvider Extraction**
	- Move the reducer + queue logic from `useProds` into `useProdQueueManager` (utility hook with no React consumer).
	- Implement `ProdsProvider`, `useProdState`, and `useProdActions` that wrap the manager and expose stable references.
	- Update `TextInput`, `ChipOverlay`, and any other prod consumers to read from the provider.
	- Make sure that we don't need dedup logic in 'api/prod/route.ts' anymore since we've confirmed our queue logic so nicely.

5. ✅ **Theme Analysis Hook**
	- Add `useThemeAnalysis` to coordinate embeddings requests, theme selections, and reruns.
	- Pages (`/write`, `/demo`) consume the hook instead of hand-rolling state, and pass results to `HighlightOverlay` / `ThemeToggleButtons`.
	- Make sure the 'api/embeddings/route.ts' file doesn't have any unnecessary memo-ization or storage layers and consumes only what it needs.

6. ✅ **Highlight Layer Stability**
	- Hypothesis disproved. Step #6 suggested deleting the segment pipeline, but that breaks the highlight overlay once you factor in the new embeddings flow. `useThemeAnalysis` purposely exposes both `highlightRanges` (currently selected themes) and `allHighlightableRanges` (`src/features/themes/hooks/useThemeAnalysis.ts:48-60`). `HighlightOverlay` builds its cut points from the superset before diffing the active set (`src/components/highlight/HighlightOverlay.tsx:41-151`), which keeps the DOM node order/length frozen even while the user toggles themes.
	- Plain-language picture: think of the textarea as lined paper and the overlay as a sheet of tracing paper. The segment helpers draw the same grid of lines on the tracing paper so every word has a reserved “seat.” When you turn a theme on, you simply color the seats that belong to it; turning it off erases the paint but the seats remain. If we ripped out the empty seats (segments), the tracing paper would shrink and the GSAP choreography would lose track of which streak is entering or exiting.
	- Keep `buildCutPoints`, `createSegments`, `computeSegmentPaintState`, and `assignChunkIndices`. Instead, tighten the implementation for clarity/perf:
		- Rename props to match intent: `currentRanges` → `activeRanges`, `allRanges` → `referenceRanges` (mirrors `highlightRanges`/`allHighlightableRanges`).
		- Memoize the maximum chunk index once per render so exit animations don’t recompute `Math.max(...chunkIndex)` inside the loop.
		- Inline a helper (`buildSegmentSnapshot`) that returns `{ paintState, chunkIndex, maxChunkIndex }` in one pass so `HighlightOverlay` doesn’t juggle separate refs.
		- Rename `SegmentMeta` to `SegmentPaintState` and colocate the helper with the highlight utilities so the “grid vs. painted cells” metaphor is explicit.

7. ✅ **Debug vs. console.log**
	- We have a 'debug.ts' fileooks like we have some console.logs when in production, but some ‘debug.dev’ logs as well. We should standardize this across the app - if it makes the logging cleaner in the code, let's default to debug.ts when appropriate. 

7.1 ✅ **RAF still necessary?**
	- investigate if we still need RAF for smooth scrolling (no jelly lag) - is it only necessary for mobile? does it help clean the desktop experience clean?

7.2 ✅ **Chip positioning deep dive**
## Current Chip Positioning System

The positioning logic is in `chipLayoutService.ts`. Overview:

### Core Algorithm

1. **Grouping & Sorting**:
   - Groups prods by sentence
   - Processes sentences top-to-bottom
   - Within each sentence, sorts: pinned first, then by timestamp

```112:119:src/services/chipLayoutService.ts
        // Sort prods in sentence: pinned first, then by timestamp (maintaining existing priority logic)
        const sorted = sentenceProds.sort((a, b) => {
            const aPinned = pinnedIds.has(a.id);
            const bPinned = pinnedIds.has(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return a.timestamp - b.timestamp;
        });
```

2. **Collision Detection**:
   - Tracks all placed chips in a `placedChips` array (across all sentences)
   - Checks vertical and horizontal overlap with minimum gaps (8px vertical, 4px horizontal)

```33:49:src/services/chipLayoutService.ts
function chipsOverlapVertically(
    pos1: SentencePosition,
    pos2: SentencePosition,
    offsetY1: number,
    offsetY2: number
): boolean {
    const chipHeight = CHIP_LAYOUT.HEIGHT;
    const verticalGap = 8; // Minimum gap between chips

    const top1 = pos1.top + offsetY1;
    const bottom1 = top1 + chipHeight;
    const top2 = pos2.top + offsetY2;
    const bottom2 = top2 + chipHeight;

    // Check for vertical overlap with minimum gap
    return !(bottom1 + verticalGap <= top2 || bottom2 + verticalGap <= top1);
}
```

3. **Desktop Positioning Strategy**:
   - Tries up to 3 vertical lanes (44px, 52px, 60px below sentence)
   - For each lane, tries up to 5 horizontal shifts (16px increments)
   - First non-colliding position wins

```223:263:src/services/chipLayoutService.ts
                // Try different vertical lanes
                for (let lane = 0; lane < maxVerticalLanes && !foundPosition; lane++) {
                    const testOffsetY = CHIP_LAYOUT.OFFSET_Y + (lane * (CHIP_LAYOUT.HEIGHT + 8));

                    // Try different horizontal positions within this lane
                    for (let shift = 0; shift < maxHorizontalShifts; shift++) {
                        const shiftIncrement = 16; // Standard increments on desktop
                        const testX = currentX + (shift * shiftIncrement);
                        let hasCollision = false;

                        // Check boundary collision (left and right edges) with safety margin
                        const absoluteLeft = testX;
                        const absoluteRight = testX + chipWidth;
                        const leftBoundary = CHIP_LAYOUT.BOUNDARY_PAD;
                        const safetyMargin = 4; // Standard safety margin on desktop
                        const rightBoundary = containerWidth - CHIP_LAYOUT.BOUNDARY_PAD - safetyMargin;

                        if (absoluteLeft < leftBoundary || absoluteRight > rightBoundary) {
                            hasCollision = true;
                            debug.dev(`Boundary collision for "${makeFingerprint(prod.text)}": left=${absoluteLeft}, right=${absoluteRight}, boundaries=${leftBoundary}-${rightBoundary}, containerWidth=${containerWidth}, safetyMargin=${safetyMargin}`);
                            continue; // Try next horizontal position
                        }

                        // Check collision with all previously placed chips
                        for (const placedChip of placedChips) {
                            if (chipsOverlapVertically(pos!, placedChip.position, testOffsetY, placedChip.offsetY) &&
                                chipsOverlapHorizontally(pos!, placedChip.position, testX - pos!.left, placedChip.offsetX, chipWidth, placedChip.width)) {
                                hasCollision = true;
                                debug.dev(`Collision detected for "${makeFingerprint(prod.text)}" at lane ${lane}, shift ${shift}`);
                                break;
                            }
                        }

                        if (!hasCollision) {
                            bestX = testX;
                            bestOffsetY = testOffsetY;
                            foundPosition = true;
                            break;
                        }
                    }
                }
```

### Potential Issues with Pinning

1. **Layout recalculation**: When you pin a chip, the layout recalculates. Pinned chips are sorted first, but if they were already placed, their positions may not change, which can cause overlaps if new chips are added.

2. **Cross-sentence collisions**: The `placedChips` array tracks all chips, but the algorithm processes sentences sequentially. If a pinned chip from sentence A overlaps with a chip from sentence B, it depends on processing order.

3. **Position persistence**: Pinned chips don't have special position locking—they're just prioritized in sorting. If the layout recalculates (e.g., on resize or new chips), they can shift.

4. **Limited search space**: Only 3 vertical lanes × 5 horizontal shifts = 15 positions. In dense areas, it may skip chips instead of finding a position.

### Mobile vs Desktop

- Mobile: Simple one-chip-per-row, vertically stacked
- Desktop: Multi-lane with collision detection

The system should prevent overlaps, but edge cases can occur, especially when pinning multiple chips in close proximity. The specs mention this was a known issue that the current implementation attempts to address.

8. **Final Polish + Comments**
	- Leave comments that explain the “why this is” not the “what this is” -> production code level comments that aren't overbearing; helpful and contextual comments!
	- Update docs (`README`, relevant `specs/*.md`) to reflect the new architecture.
	- Consider extracting the pure queue/dedup logic from `useProdQueueManager` into `src/lib/` once the provider work settles so the hook stays focused on wiring, not data transforms.
	- Re-run `bun run lint` 

9. **Update tests**
	- We have a whole set of tests that probably reference the old file structure that need updating. 
	- update the test file imports/setup of data etc.
	- make sure everything works by running bun test (NOT bun run test, we're using bun's internal test runner)
	- for good measure, use biome lint and formatting too

## Open Questions / Follow-ups
- Should `ProdsProvider` live at the page level or inside `TextInput`? (Recommendation: wrap the editor area so future panels can also read prod state.) - let's go with your recommendation if it is simplest. 
- Once the architecture stabilizes, consider re-introducing mobile ergonomics selectively if needed, but only after core hooks are covered by tests/specs. - let's ignore for now. 
- Determine whether theme analysis should live alongside prod state in a single “WritingSessionProvider” later; for now keep them separate for clarity. - keep them separate for now, there are essentially two features for this web app, so I'd like them to be separate in the code as well. 
- Evaluate extracting the shared `/write` + `/demo` page shell (timer, header, `TextInput`, overlays) into a dedicated component once the hook refactor settles so the surfaces stay in sync without duplication.

This plan keeps the current storytelling flow intact—timer → writing surface → prods → themes—while making each piece explicit, testable, and ready for code review discussions.
