# Project Spec: Better Prod Selection

## Overall Goal

Improve the quality and relevance of prods by implementing a two-stage AI system: first generate multiple prods per sentence, then use a selection AI to pick the best one based on broader context and sentence-specific relevance.

## Problem Statement

Current system generates 1-2 prods per API call, but these prods often lack context awareness and may not be the best choice for the specific sentence. We need a more sophisticated approach that:

1. Generates multiple candidate prods per sentence
2. Evaluates them against the full text context
3. Selects the most relevant and impactful prod for each sentence

## Milestones

### 👉 Milestone 1 — Enhanced Prod Generation

Goal: Modify the existing prod API to generate more candidates per sentence.

Changes to `/api/prod`:

- Increase max prods from 2 to 4-6 candidates
- Update system prompt to generate diverse, high-quality candidates
- Maintain current response format for backward compatibility

Tech changes:

- Update `ProdsSchema` to allow 4-6 prods
- Enhance system prompt to encourage variety and quality
- Add diversity constraints (different types of questions, different angles)

Deliverable: API returns 4-6 high-quality prod candidates per call.

### Milestone 2 — Selection API Route

Goal: Create new `/api/selection` endpoint that picks the best prod from candidates.

New API endpoint:

- POST `/api/selection`
- Input: `{ text: string, sentence: string, prods: string[], sentenceId: string }`
- Output: `{ selectedProd: string, confidence: number, reasoning: string }`

Selection criteria:

- Relevance to the specific sentence
- Context awareness (how it fits with the broader text)
- Impact potential (likelihood to provoke deeper thinking)
- Uniqueness (avoiding repetitive patterns)

Tech implementation:

- New route file: `src/app/api/selection/route.ts`
- Selection schema with confidence scoring
- Enhanced system prompt for evaluation
- Maintain compatibility with existing `Prod` interface and `sentenceId` linking

Deliverable: API that can intelligently select the best prod from a list of candidates.

### Milestone 3 — Integration & Testing

Goal: Integrate the selection system into the main app flow.

Integration changes:

- Modify `useProds.ts` to call both APIs in sequence
- Update prod creation to use selected prod while maintaining existing `Prod` interface
- Ensure `sentenceId` linking works correctly for chip positioning
- Add error handling and fallback to original system

Testing:

- Verify chip positioning works with selected prods using existing `positionUtils.ts`
- Ensure `sentenceId` and `prod.id` relationships are maintained
- Test fallback behavior when selection API fails

Deliverable: Full integration with improved prod quality.

### ✅ Milestone 4 — Sequential Processing Queue

Goal: Implement ordered processing so prods appear top-down, simulating AI reading along.

Problem: Currently prods appear in reverse order (most recent sentences first), but should appear as if AI is "catching up" by reading from top to bottom.

Implementation:

- Add processing queue to `useProds.ts` that maintains sentence order
- Process API calls sequentially rather than concurrently
- Ensure prods appear in writing order (top-down) rather than completion order
- Maintain throttling but respect document flow
- Add visual feedback showing AI "progress" through the document

Technical details:

- Queue data structure for pending sentence processing
- Sequential async processing with proper error handling
- Preserve existing throttling and debounce behavior
- Update UI to show processing state per sentence

Deliverable: Prods appear in document order, creating natural reading flow.

### ✅ Milestone 5 — Queue Robustness & Performance

Goal: Fix critical queue issues that could cause stalls, memory leaks, and rate limit violations.

Problems identified:

1. **Throttle stall bug**: Queue can permanently freeze if throttled with no wake-up timer
2. **Memory leak**: Completed/failed items never leave queue, causing unbounded growth
3. **Missing cancellation**: No AbortController for cleanup on unmount/navigation
4. **Rate limit risk**: Batch throttling may still overwhelm APIs with rapid sequential calls
5. **Effect fragility**: useEffect-driven runner can miss updates or hit timing issues

Implementation:

- Add throttle wake-up timer to prevent permanent stalls
- Remove completed/failed items from queue to prevent memory leaks
- Implement AbortController for proper request cancellation
- Add per-item rate limiting instead of batch-only throttling
- Consider ref-based runner pattern for more reliable processing
- Add queue clear() method for navigation/reset scenarios

Technical details:

- Throttle wake-up: `setTimeout` to retrigger processing after throttle period
- Memory cleanup: Remove items in `COMPLETE_PROCESSING`/`FAIL_PROCESSING` actions
- Cancellation: `AbortController` passed to both prod and selection fetches
- Rate limiting: Per-item delay with `nextAvailableAt` ref tracking
- Defensive type checking: Validate API response shapes
- Cleanup: `onBeforeUnload` and unmount abort handlers

Deliverable: Robust queue that never stalls, leaks memory, or overwhelms APIs.

### Milestone 6 — Advanced Selection Features

Goal: Add more sophisticated selection criteria and learning.

Advanced features:

- Track which prods get clicked/engaged with
- Add sentiment analysis to avoid tone mismatches
- Consider writing style and user preferences
- Integration with semantic embeddings for better context understanding

## Technical Architecture

### API Flow

```
User types → Sentence detection → Queue sentence → Process queue sequentially:
  [Sentence 1] → /api/prod → /api/selection → Display chip
  [Sentence 2] → /api/prod → /api/selection → Display chip
  [Sentence 3] → /api/prod → /api/selection → Display chip
```

### Data Structures

```typescript
// Selection API input
interface SelectionRequest {
  text: string; // Full document text
  sentence: string; // Target sentence
  prods: string[]; // Candidate prods
  sentenceId: string; // Sentence ID for positioning
}

// Selection API output
interface SelectionResponse {
  selectedProd: string; // Best prod
  confidence: number; // 0-1 confidence score
  reasoning: string; // Why this prod was selected
}

// Existing Prod interface (for reference)
interface Prod {
  id: string; // Unique prod ID
  text: string; // Prod text
  sentenceId: string; // Links to sentence for positioning
  timestamp: number; // Creation timestamp
}
```

### Error Handling

- Fallback to original system if selection fails
- Graceful degradation if one API is down
- Retry logic for transient failures

## Success Metrics

- More relevant prod positioning
- Reduced repetitive or generic prods

## Future Considerations

- Integration with semantic embeddings for better context understanding

# Working With This Doc

- add 👉 to the milestone currently being worked on
- add ✅ to the milestone when completed
- only handle one milestone at a time
- update technical details as implementation progresses
