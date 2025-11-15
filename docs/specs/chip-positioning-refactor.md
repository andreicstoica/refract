# Chip Positioning Refactor Specification

## Problem Statement

Current chip positioning system has several issues:

1. **Boundary violations**: Chips can extend beyond textarea left/right bounds
2. **Collision detection**: Chips can overlap, making text unreadable
3. **Edge case handling**: Poor handling when sentences end near boundaries
4. **Layout complexity**: Current single-row layout doesn't scale well

## Requirements

### Core Constraints

- Chips must stay within textarea content bounds (left: 16px, right: containerWidth - 16px)
- Chips must never overlap with each other
- Chips must appear directly under their associated sentences
- Support for multiple chips per sentence
- Handle edge cases gracefully (boundary overflow, line wrapping)

### Layout Strategy

#### 1. Multi-Row Layout System

Instead of single-row horizontal layout, implement a flexible multi-row system:

- Primary row: Directly under sentence
- Secondary rows: Below primary row with offset
- Maximum 3 rows per sentence to prevent excessive vertical growth

#### 2. Boundary-Aware Positioning

- **Left boundary**: Minimum 16px from container edge
- **Right boundary**: Maximum containerWidth - 16px - chipWidth
- **Overflow detection**: If chip would overflow right boundary, move to next row
- **Minimum width**: Ensure chips don't become too narrow (min 120px)

#### 3. Collision Detection Algorithm

```typescript
interface ChipSlot {
  sentenceId: string;
  row: number;
  left: number;
  right: number;
  top: number;
}

interface ChipPlacement {
  horizontalOffset: number;
  verticalOffset: number;
  row: number;
}
```

#### 4. Placement Logic

1. **Group chips by sentence** (maintains association)
2. **Sort chips by timestamp** (consistent ordering)
3. **Calculate available slots** for each sentence
4. **Place chips in optimal positions** avoiding collisions
5. **Handle overflow** by moving to next row or adjusting position

### Implementation Plan

#### Phase 1: Core Layout Engine

- Create `ChipLayoutEngine` class
- Implement boundary detection
- Add collision detection
- Support multi-row placement

#### Phase 2: Integration

- Replace current `ChipOverlay` layout logic
- Update `Chip` component positioning
- Add visual debugging tools

#### Phase 3: Edge Case Handling

- Boundary overflow scenarios
- Line wrapping for long chips
- Dynamic resizing support

### Edge Cases to Handle

1. **Sentence at right edge**: When sentence ends near right boundary

   - Solution: Start chip placement from left boundary, not sentence start

2. **Multiple chips for edge sentence**:

   - Solution: Use multi-row layout with proper overflow detection

3. **Very long chip text**:

   - Solution: Truncate with ellipsis, maintain minimum width

4. **Container resize**:

   - Solution: Recalculate all positions on resize

5. **Dynamic chip addition/removal**:
   - Solution: Recalculate affected sentence layouts only

### Performance Considerations

- **Memoization**: Cache layout calculations per sentence group
- **Incremental updates**: Only recalculate when necessary
- **Debounced resize**: Avoid excessive recalculations
- **Virtual positioning**: Use CSS transforms for smooth animations

### Testing Strategy

1. **Unit tests**: Layout engine logic
2. **Visual tests**: Boundary scenarios, collision scenarios
3. **Performance tests**: Large numbers of chips
4. **Edge case tests**: Boundary conditions, resize scenarios

## Success Metrics

- ✅ No chips extend beyond textarea bounds
- ✅ No chip overlaps with other chips
- ✅ Chips maintain association with correct sentences
- ✅ Smooth animations and transitions
- ✅ Performance remains good with 10+ chips
- ✅ Handles all edge cases gracefully
