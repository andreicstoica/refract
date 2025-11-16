# Prod System v2 Specification

## Problem Statement

The current prod system has several user experience issues that reduce the effectiveness of contextual writing suggestions:

### 1. Timing & Flow Issues

- **Late arrivals**: Prods can take up to 10 seconds to return, sometimes longer, by which time users have moved to new topics
- **Context mismatch**: Late prods become jarring and irrelevant to current writing context
- **Waterfall effect**: Queued prods flood in rapidly when user pauses, overwhelming the interface

### 2. Quality & Repetition

- **Topical repetition**: Multiple prods suggest similar concepts even when well-written
- **Over-production**: Not every sentence warrants a contextual suggestion
- **Prompt improvements**: Recent changes help but need systematic approach

### 3. UI Details Gone Wrong

- **Overlapping**: Sometimes the prods will overlap with others
- **Layout shift**: Sometimes, the prods will move lines as the user continues writing (rare)

### 3. Current Technical Architecture (accurate as of today)

- Triggers: punctuation trigger; 60-character threshold since last trigger; 1.5s trailing debounce; 1.2s cooldown. No fixed "3s idle" trigger.
  - Source: `@/hooks/useTextProcessing` (`CHAR_TRIGGER=60`, `TRAILING_DEBOUNCE_MS=1500`, `COOLDOWN_MS=1200`).
- Queue + rate limiting: queue-driven batching (2 concurrent) with ~150ms per-call delay and ~500ms throttle between queue cycles.
  - Source: `@/hooks/useProds` (`waitForRateLimit(150)`, batch size 2, queue throttling).
- Sentence filtering + dedup: pre-filter obvious non-candidates and show only first prod per sentence.
  - Source: `@/utils/shouldProcessSentence`, `@/utils/prodSelectors`.
- Positioning: anchor-based mirror div with sentence span measurement; working well.
  - Source: `@/utils/positionUtils`, `@/components/ChipOverlay.tsx`, `@/components/Chip.tsx`.
- Sentence splitting: custom lightweight splitter (not using compromise.js today).
  - Source: `@/utils/sentenceUtils`.
- API (prod v1 shape): `POST /api/prod` with `{ lastParagraph, fullText }` → `{ selectedProd, shouldSkip, confidence }`.
  - Source: `@/features/prods/services/prodClient`, `@/app/api/prod/route.ts`, `@/types/api`.

## Proposed Solutions

### A. Intelligent Timing & Context Awareness

#### 1. Context Window Management

```typescript
interface TopicState {
  keywords: string[];
  emaOverlap: number;
  lowCount: number;
  lastUpdate: number;
}

const DEFAULTS = {
  threshold: 0.3, // Single overlap threshold
  minConsecutive: 2, // Grace period before shift
  alpha: 0.5, // Smoothing factor
  keywordLimit: 15, // Cap keywords for performance
};
```

- **Topic shift detection**: Use compromise.js to extract keywords, then detect shifts via Jaccard overlap with exponential moving average smoothing.
- **Context invalidation**: Cancel pending prod requests when topic shifts significantly.
- **Minimal complexity**: Simple state tracking with configurable thresholds.

#### 2. Timeout and Cancellation (simplified)

```typescript
// Hard timeout for all prod requests
const REQUEST_TIMEOUT_MS = 9000;

// Event-driven cancellation rules
// - Cancel in-flight request if: new trigger fires for same/next sentence
// - Cancel in-flight request if: topic shift detected
// - Stale guard: drop any in-flight > 5000ms when a new prod is enqueued
```

- Idle allowance: If the user is not typing (no new triggers), in-flight requests may run the full 9s window; the stale guard only evaluates when new prods are enqueued.

### B. Quality & Relevance Improvements

#### 1. Prod Necessity Scoring

Before generating prods, evaluate:

- **Semantic novelty**: Is this sentence introducing new concepts?
- **Complexity indicator**: Does the sentence suggest the user might benefit from expansion?
- **Recent prod density**: Have we shown prods for similar content recently?

#### 2. Dynamic Prompt Context

```typescript
interface ProdContext {
  recentProds: string[]; // Last 3-5 prods shown
  topicKeywords: string[]; // Current topic indicators (from compromise)
  sessionDuration: number; // Adjust verbosity over time
}
```

#### 3. Prod Filtering Pipeline

```typescript
type ProdFilter = {
  semanticSimilarity: (prod: string, recent: string[]) => number;
  topicalRelevance: (prod: string, context: string) => number;
  timingRelevance: (prod: string, currentContext: string) => number;
};
```

### C. Adaptive Frequency Control

- Retain current punctuation/character/debounce/cooldown heuristics; revisit later only if needed.

## Implementation Strategy

### Phase 1: Timing Improvements

1. Add compromise-based topic shift detection (keywords + overlap)
2. Add absolute timeout (AbortController) + event-driven cancellation
3. Cancel irrelevant pending requests on topic shift (and apply stale guard)

### Phase 2: Quality Filters

1. Build prod necessity scoring
2. Implement semantic similarity filtering
3. Add recent prod context to prompt

### Phase 3: Optional Adaptation (Future)

1. Explore writing state detection (flow/pause/explore)
2. If useful, use it to gently tune `CHAR_TRIGGER`/cooldown

## Technical Architecture

### New Hooks & Services

```typescript
// Topic shift detection (client-only)
export const useTopicShiftDetection = () => {
  // Extract keywords via compromise.js (nouns & noun-phrases, lemmatized)
  // Detect shifts via Jaccard overlap with EMA smoothing
  // Performance: ~1-6ms per update for typical writing sessions
  return { topicKeywords, hasTopicShift, updateTopicState };
};

// Enhanced prod orchestration (built on existing hooks)
export const useProdsEnhanced = () => {
  // wrap `useProds` to add:
  // - AbortController with REQUEST_TIMEOUT_MS
  // - cancel on new trigger for same/next sentence
  // - cancel on topic shift
  // - stale guard (drop >5s in-flight on new enqueue)
  // - pass optional context (recentProds, topicKeywords) to API
  return { callProdAPI, clearQueue, queueState, prods };
};
```

### API Enhancements

```typescript
// /api/prod request enhancement (backward compatible)
// Keep clear names; all new fields optional
interface ProdRequest {
  lastParagraph: string;
  fullText?: string;
  recentProds?: string[];
  topicKeywords?: string[];
}
```

### NLP (compromise.js) Notes

- Use `compromise` to extract lemmatized nouns and noun phrases for `topicKeywords`.
- Keep usage minimal and efficient; consider lazy/dynamic import if bundle size becomes a concern.
- All NLP runs on the client; no server/database.
- Performance: ~1-5ms for keyword extraction, ~0.1ms for topic shift detection.
- Optimized for 1-5 minute writing sessions with fast adaptation.

### Interaction Tracking (No DB)

- No server/database integration. Track interaction quality locally.
- Use in-memory state and `localStorage` via `@/features/writing/services/storage` for ephemeral analytics:
  - recent prods shown/clicked/dismissed counts
  - last N `topicKeywords` snapshots and derived preferences
  - session timestamps for simple heuristics

## Future Considerations

### Writing State (optional tuning)

- If added, keep scoped to simple effects (e.g., adjust `CHAR_TRIGGER`/cooldown during sustained high typing rate).
- Could later extend API to include `writingState` if it proves valuable.

### Learning & Personalization

- User interaction patterns to improve prod selection (local only)
- Personal writing style adaptation (local heuristics)
- Topic preference learning (local heuristics)

### Advanced Features

- Multi-modal prods (text + visual suggestions)
- Collaborative writing support (out of scope for local-only)
- Integration with theme/bubble visualization

## Module References

- Hooks: `@/hooks/useTextProcessing`, `@/hooks/useProds`, `@/hooks/useGenerateEmbeddings`
- Services: `@/features/prods/services/prodClient`, `@/features/themes/services/embeddingsClient`, `@/features/writing/services/storage`
- Types: `@/types/api`, `@/types/prod`, `@/types/sentence`, `@/types/queue`, `@/types/theme`
- Utils: `@/utils/sentenceUtils`, `@/utils/positionUtils`, `@/utils/shouldProcessSentence`, `@/utils/prodSelectors`
- NLP: `compromise` (keywords and topic shifts)

## Testing Impact

- Update or add unit tests for:
  - compromise-based keyword extraction and topic shift detection
  - Jaccard overlap calculation and EMA smoothing
  - absolute timeout + AbortController behavior in `@/features/prods/services/prodClient`
  - event-driven cancellations (new trigger, topic shift, stale guard)
- Keep existing tests for sentence splitting, embedding utils, and general utils passing.
- Run with `bun run test`. Expand coverage later if we add more utilities.
