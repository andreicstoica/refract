# Chip Positioning & Duplicate Prevention Cleanup

## Problem Statement

The current chip positioning system has several critical issues that need to be addressed:

### 1. Chip Overlap Issues

- **Problem**: Multiple chips can overlap each other, making them unreadable
- **Root Cause**: The collision detection system in `src/lib/chips/chipLayout.ts` may have edge cases
- **Impact**: Poor user experience, chips become unusable

### 2. Poor Horizontal Positioning

- **Problem**: Chips tend to cluster on the far left side of the screen
- **Root Cause**: The positioning algorithm prioritizes left alignment over natural sentence flow
- **Impact**: Chips don't feel connected to their target sentences

### 3. Duplicate Prod Generation

- **Problem**: Multiple API calls may be generated for the same sentence/chunk
- **Root Cause**: The deduplication logic in `useTextProcessing.ts` may not be comprehensive enough
- **Impact**: Wasted API calls, potential for duplicate chips

## Technical Analysis

### Current Deduplication Logic

The system has some deduplication in place:

```typescript
// In useTextProcessing.ts
if (
  lastTriggerSentenceIdRef.current === lastSentence.id &&
  lastTriggerSentenceTextRef.current === lastSentence.text
) {
  console.log("🔄 Already processed exact sentence");
  return false;
}
```

**Issues with current approach:**

1. Only checks the most recent sentence ID and text
2. Doesn't account for sentence ID regeneration when text changes
3. No persistent tracking across text modifications

### Current Positioning Logic

The `computeChipLayout` function in `src/lib/chips/chipLayout.ts` has sophisticated collision detection but:

1. Uses complex multi-row logic that may have edge cases
2. Prioritizes left alignment over natural sentence positioning
3. May have boundary detection issues in certain scenarios

## Proposed Solutions

### Phase 1: Eliminate Duplicate Prod Generation

**Goal**: Ensure at most one prod API call per unique sentence

#### 1.1 Enhanced Deduplication System

```typescript
interface ProcessedSentence {
  id: string;
  text: string;
  timestamp: number;
  prodGenerated: boolean;
}

// Track all processed sentences, not just the last one
const processedSentencesRef = useRef<Map<string, ProcessedSentence>>(new Map());
```

**Implementation:**

- Track all sentences that have been processed in a Map
- Use sentence ID as key, store text content and processing status
- Check both ID and content hash before triggering new prods
- Clean up old entries periodically to prevent memory leaks

#### 1.2 Sentence ID Stability

**Problem**: Sentence IDs change when text is modified, causing duplicate processing

**Solution**: Use content-based hashing for deduplication

```typescript
function generateSentenceHash(
  text: string,
  startIndex: number,
  endIndex: number
): string {
  const content = text.slice(startIndex, endIndex).trim();
  return btoa(content).slice(0, 8); // Simple hash for deduplication
}
```

#### 1.3 API-Level Deduplication

Add deduplication at the API level as a safety net:

```typescript
// In /api/prod route
const requestHash = createHash("md5").update(lastParagraph).digest("hex");
const cacheKey = `prod:${requestHash}`;

// Check if we've already processed this exact text
if (await redis.exists(cacheKey)) {
  return Response.json({ shouldSkip: true });
}
```

### Phase 2: Improve Chip Positioning

**Goal**: Enhance existing positioning system for better natural alignment

#### 2.1 Natural Sentence Positioning

Position chips to feel more connected to their sentences:

```typescript
function getNaturalChipPosition(
  sentencePos: SentencePosition,
  containerWidth: number
): number {
  const sentenceEnd = sentencePos.left + sentencePos.width;
  const chipWidth = 120; // Default chip width

  // Try to position chip near the end of the sentence
  let preferredPosition = sentenceEnd - chipWidth;

  // Ensure it stays within bounds
  preferredPosition = Math.max(
    16,
    Math.min(preferredPosition, containerWidth - chipWidth - 16)
  );

  return preferredPosition;
}
```

#### 2.2 Enhanced Collision Detection

Improve the existing collision detection in `src/lib/chips/chipLayout.ts`:

```typescript
// In src/lib/chips/chipLayout.ts - enhance the existing computeChipLayout function
function computeChipLayout(
  prods: Prod[],
  sentencePositions: Map<string, SentencePosition>,
  bounds: LayoutBounds
): Map<string, ChipPlacement> {
  // ... existing logic ...

  // Add natural positioning preference
  const naturalPosition = getNaturalChipPosition(pos, bounds.containerWidth);

  // ... rest of existing logic with natural positioning as preferred starting point
}
```

## Implementation Plan

### Milestone 1: Fix Duplicate Generation (Priority: High)

1. **Enhanced Deduplication**

   - Add `ProcessedSentence` tracking in `useTextProcessing.ts`
   - Implement content-based hashing for sentence identification
   - Add cleanup logic to prevent memory leaks

2. **API Safety Net**

   - Add request deduplication in `/api/prod` route
   - Implement simple in-memory cache for recent requests

3. **Testing**
   - Add unit tests for deduplication logic
   - Manual testing to verify no duplicate API calls

### Milestone 2: Improve Positioning (Priority: High)

1. **Enhance Existing Layout Engine**

   - Modify `computeChipLayout` in `src/lib/chips/chipLayout.ts` for natural positioning
   - Add natural sentence alignment preference
   - Improve boundary detection edge cases

2. **Update Components**

   - Modify `ChipOverlay.tsx` to use enhanced positioning
   - Update `Chip.tsx` for visual connection indicators
   - Keep existing collision detection system

3. **Testing**
   - Visual testing for chip positioning
   - Ensure no overlaps occur
   - Verify chips feel connected to sentences

## Success Metrics

### Duplicate Prevention

- ✅ Zero duplicate API calls for the same sentence content
- ✅ Memory usage remains stable during long writing sessions
- ✅ Deduplication works across text modifications

### Positioning Quality

- ✅ No chip overlaps in normal usage
- ✅ Chips appear naturally positioned relative to their sentences
- ✅ Positioning feels intuitive and connected

### Performance

- ✅ Chip positioning calculations < 16ms for 60fps
- ✅ No layout thrashing during chip updates
- ✅ Smooth animations without jank

## Technical Details

### File Changes Required

**Primary Changes:**

- `src/hooks/useTextProcessing.ts` - Enhanced deduplication
- `src/lib/chips/chipLayout.ts` - Improved positioning logic
- `src/components/ChipOverlay.tsx` - Updated positioning integration
- `src/components/Chip.tsx` - Visual improvements

**New Files:**

- `src/lib/sentenceHash.ts` - Content-based sentence identification

**API Changes:**

- `src/app/api/prod/route.ts` - Add request deduplication

### Dependencies

- No new external dependencies required
- Use existing React patterns and utilities

## Future Considerations

### Multi-Row Support (Already Implemented)

The existing system already supports multi-row positioning:

- Up to 3 rows per sentence
- Collision detection between rows
- Boundary-aware placement

### Advanced Features

- User preference for chip positioning style
- Chip clustering for related content
- Integration with theme visualization

## Rollout Strategy

1. **Phase 1**: Deploy duplicate prevention (low risk, high impact)
2. **Phase 2**: Deploy enhanced positioning (medium risk, high impact)
3. **Phase 3**: Deploy visual improvements (low risk, medium impact)

Each phase should be tested thoroughly before moving to the next, with rollback plans in place.

## Testing Strategy

### Unit Tests

- Deduplication logic in `useTextProcessing.ts`
- Positioning calculations in `src/lib/chips/chipLayout.ts`
- Sentence hashing utilities

### Integration Tests

- End-to-end prod generation flow
- Chip positioning with various text scenarios
- Memory usage over time

### Visual Tests

- Manual testing of chip positioning
- Cross-browser compatibility
- Mobile responsiveness

This spec provides a clear path to fixing the core issues while maintaining the existing functionality and improving the user experience.
