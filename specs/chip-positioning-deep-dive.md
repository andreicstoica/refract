# Chip Positioning Deep Dive Specification

This document provides a comprehensive analysis of the chip positioning system in Refract, covering both the prod generation pipeline and the spatial positioning logic.

## System Overview

The chip positioning system consists of two main subsystems:

1. **Prod Generation Pipeline** - Determines when and how to generate AI-powered suggestions (prods)
2. **Spatial Positioning System** - Calculates where to place chips on screen without overlaps or boundary violations

## Part I: Prod Generation Pipeline

### Architecture Overview

The prod generation system follows this flow:

```
User Types → Text Processing → Sentence Detection → Prod Triggers → API Calls → Chip Display
```

### Key Components

#### 1. Text Processing Hook (`useTextProcessing.ts`)

**Core Responsibilities:**

- Monitors user input for typing patterns
- Splits text into sentences using punctuation detection
- Manages multiple timeout systems for prod triggering
- Handles sentence position measurement for chip placement

**Timeout Systems:**

1. **Sentence Split Debouncing (200ms)**

   - Debounces sentence parsing to avoid excessive splits during rapid typing
   - Flush immediately on terminal punctuation (`.!?;:`)
   - Purpose: Optimize performance while maintaining responsiveness

2. **Settling Timer (3000ms in prod, 1500ms in demo)**

   - Triggers when user stops typing for the settling duration
   - Only fires if other trigger conditions haven't been met
   - Purpose: Ensure prods are generated even without punctuation

3. **Watchdog Timer (6000ms check interval)**

   - Runs every 1 second, checks for 6+ seconds of inactivity
   - Forces prod generation to keep users engaged
   - One-time trigger per idle period (re-arms on user input)

4. **Rate Limiting (7000ms in prod, 3000ms in demo)**
   - Minimum time between API calls to prevent spam
   - Built into the `useProds` hook queue system

#### 2. Sentence Detection Logic (`sentences.ts`)

**Splitting Algorithm:**

- Detects terminal punctuation: `.`, `!`, `?`
- Requires whitespace or end-of-string after punctuation
- Preserves exact substring indices for stable positioning
- Generates content-based IDs for sentence tracking

**Position Measurement:**

- Creates invisible DOM mirror element matching textarea styles
- Injects sentence spans to measure exact positioning
- Returns coordinates in content space (excluding scroll offset)
- Uses caching to optimize repeated measurements

#### 3. Prod Triggering Logic (`useTextProcessing.ts`)

**Trigger Conditions (OR logic):**

1. **Punctuation Trigger**

   - Immediate trigger on terminal punctuation (`.!?;:`)
   - Most responsive trigger for natural writing flow

2. **Soft Comma Trigger**

   - Triggers on comma if sentence ≥25 chars and ≥8 chars written since last trigger
   - Provides mid-sentence prod opportunities

3. **Character Threshold Trigger**

   - Triggers after configurable character count (150 in prod, 75 in demo)
   - Ensures prods for long sentences without punctuation

4. **Settling Trigger**

   - Activates after user stops typing for settling duration
   - Fallback trigger for any remaining content

5. **Watchdog Trigger**
   - Force triggers during idle periods to maintain engagement
   - Uses `{ force: true }` flag to bypass normal filters

**Content Filtering:**

- Minimum sentence length: 12 characters (configurable)
- Skips punctuation-only content, URLs, simple greetings
- Early content filter requires 50+ total characters or 20+ sentence characters

### 4. Prod Queue System (`useProds.ts`)

**Queue Architecture:**

- LIFO (Last In, First Out) processing prioritizes recent content
- Single-flight processing prevents concurrent API calls
- Maximum queue size: 5 items (demo), 3 items (prod)
- Automatic pruning of old queue items

**Request Management:**

- Each request gets AbortController for cancellation
- Topic version tracking prevents stale prods after topic shifts
- Comprehensive deduplication using multiple strategies

**Deduplication Strategies:**

1. **Sentence ID Deduplication**

   - Prevents multiple prods for same sentence ID
   - Primary deduplication mechanism

2. **Content Fingerprinting**

   - 30-character prefix + length fingerprint
   - Prevents similar content from generating multiple prods
   - Timeout: 60s (demo), 15s (prod)

3. **Text Normalization Deduplication**

   - Lowercase, trimmed text matching
   - Timeout: 60s (demo), 20s (prod)

4. **Recent Production Tracking**

   - Maps sentence text to production timestamps
   - Prevents rapid re-generation for same content
   - Self-cleaning with 2-minute retention

5. **Queue Deduplication**
   - Checks pending/processing queue items
   - Prevents duplicate queue entries

**API Integration:**

- 15-second timeout with graceful fallback
- Confidence thresholding (0.5 prod, 0.05 demo)
- Automatic retry logic for failed requests
- Request cancellation on topic shifts

## Part II: Spatial Positioning System

### Architecture Overview

The positioning system calculates chip placement to avoid overlaps and boundary violations while maintaining visual connection to source sentences.

### Key Components

#### 1. Chip Overlay (`ChipOverlay.tsx`)

**Core Responsibilities:**

- Manages chip positioning calculations and collision detection
- Handles container dimension tracking and scroll synchronization
- Provides fallback positioning for orphaned prods

**Container Management:**

- Uses ResizeObserver for responsive width tracking
- Synchronizes scroll position using RAF coalescing
- Mirrors textarea padding and styling for accurate positioning

#### 2. Layout Calculation System

**Collision Detection Algorithm:**

The system uses a sophisticated multi-row layout with priority-based positioning:

1. **Prod Sorting**

   - Pinned prods get priority positioning
   - Within priority groups, sort by timestamp (oldest first)
   - Ensures consistent, predictable chip placement

2. **Boundary Calculation**

   - Left boundary: 16px content padding
   - Right boundary: container width - gutter - 8px padding
   - Minimum chip width: 120px
   - Row gap: 20px between vertical levels

3. **Chip Width Estimation**

   - Dynamic width based on text length: `max(120px, text.length * 7.5 + 40px)`
   - Provides reasonable width estimation without full text measurement

4. **Positioning Logic (End-Aligned Strategy)**

   ```typescript
   // Position chip so its right edge aligns with sentence end
   const sentenceEndX = contentLeftPad + pos.left + pos.width;
   let startX = sentenceEndX - estimatedWidth;

   // Clamp to container boundaries
   startX = Math.max(contentLeftPad, Math.min(startX, rightLimit - estW));
   ```

5. **Multi-Row Placement**

   - Primary row: 44px below sentence (preferred)
   - Secondary row: 64px below sentence (44px + 20px gap)
   - Row selection based on available horizontal space

6. **Collision Detection**
   - Uses position keys: `"${top}-${left}-${verticalOffset}"`
   - Iterative horizontal shifting (32px increments) until position is free
   - Overflow detection moves chip to next row when right boundary exceeded

#### 3. Chip Component (`Chip.tsx`)

**Positioning Logic:**

- Uses ChipOverlay-calculated offsets when available
- Fallback positioning for legacy scenarios
- Dynamic width constraints with CSS clamp functions

**Visual Design:**

- End-aligned text with ellipsis truncation
- Pin icon for user interaction feedback
- Respect CSS custom properties for gutters and spacing

### Advanced Features

#### 1. Pinned Chip Priority

Pinned chips (user has clicked to keep them) get priority placement:

- Processed first during layout calculation
- Prevents displacement by newer chips
- Maintains user's explicitly-saved content

#### 2. Responsive Design

The system adapts to various screen sizes:

- CSS custom properties for responsive gutters
- Dynamic width calculations based on container size
- Mobile-optimized tap targets and spacing

#### 3. Performance Optimizations

**Memoization:**

- Layout calculations memoized based on prods and container width
- Position cache in sentence measurement system
- Prevents unnecessary recalculations

**Scroll Optimization:**

- RAF-coalesced scroll event handling
- CSS transforms for smooth position updates
- Separate content coordinate system independent of scroll

**Memory Management:**

- Automatic cleanup of old fingerprint entries
- Cache size limits with LRU eviction
- Efficient Map-based data structures

### Boundary and Edge Case Handling

#### 1. Right Boundary Overflow

**Problem:** Sentence ends near right edge, chip would extend beyond container
**Solution:**

- Clamp chip start position to fit within boundaries
- Use maxWidth property to constrain chip size
- Graceful text truncation with ellipsis

#### 2. Multiple Chips Per Sentence

**Problem:** Multiple prods for same sentence could overlap
**Solution:**

- Row-based layout system
- Collision detection with horizontal shifting
- Maximum 3 rows to prevent excessive vertical growth

#### 3. Container Resizing

**Problem:** Window resize could break existing chip positions  
**Solution:**

- ResizeObserver tracks container width changes
- Automatic position recalculation on resize
- Debounced updates to prevent excessive calculations

#### 4. Long Text Content

**Problem:** Very long chip text could break layout
**Solution:**

- Dynamic width estimation with reasonable limits
- CSS clamp functions for responsive width constraints
- Text truncation preserves readability

#### 5. Empty or Invalid Positions

**Problem:** Sentence positions may be unavailable due to DOM timing
**Solution:**

- Fallback position search using text matching
- Multiple matching strategies (exact, prefix, substring)
- Graceful degradation with warning logs

### Configuration and Customization

#### Responsive Design Variables

The system uses CSS custom properties for responsive behavior:

```css
--chip-gutter: 8px; /* Responsive gutter size */
```

#### Timing Configuration

Different timing profiles for production vs demo modes:

```typescript
// Production
{
  cooldownMs: 7000,
  settlingMs: 3000,
  charTrigger: 150,
  rateLimitMs: 7000
}

// Demo Mode
{
  cooldownMs: 3000,
  settlingMs: 1500,
  charTrigger: 75,
  rateLimitMs: 3000
}
```

#### Layout Constants

Key positioning parameters:

- Content left padding: 16px
- Right padding: 8px (plus gutter)
- Row gap: 20px
- Minimum chip width: 120px
- Collision offset: 32px horizontal shift
- Maximum rows per sentence: 3 (implied by logic)

## System Integration

### Data Flow

1. **Text Input** → `useTextProcessing.handleTextChange`
2. **Sentence Detection** → `splitIntoSentences`
3. **Position Measurement** → `measureSentencePositions`
4. **Trigger Evaluation** → Multiple timeout/threshold checks
5. **Queue Management** → `useProds.callProdAPI`
6. **API Request** → `/api/prod` with deduplication
7. **Layout Calculation** → `ChipOverlay.layoutByProdId`
8. **Chip Rendering** → `Chip` component with calculated positions

### State Management

The system maintains several interconnected state layers:

- **Text State**: Current input text and parsed sentences
- **Position State**: Measured sentence coordinates
- **Prod State**: Generated prods with metadata
- **Queue State**: Pending API requests and processing status
- **Layout State**: Calculated chip positions and collision data

### Error Handling and Resilience

**API Failures:**

- Graceful timeout handling with soft skip responses
- Request cancellation for topic shifts and duplicates
- Retry logic for transient failures

**Position Calculation Failures:**

- Fallback text matching for orphaned prods
- Default positioning when measurements unavailable
- Console warnings for debugging without breaking functionality

**Performance Degradation:**

- Queue size limits prevent memory bloat
- Cache eviction maintains bounded memory usage
- Debounced updates prevent excessive calculations

## Future Considerations

### Potential Improvements

1. **Advanced Collision Detection**

   - Consider chip height in collision calculations
   - More sophisticated packing algorithms
   - Visual connection lines between chips and sentences

2. **Enhanced Responsive Design**

   - Breakpoint-specific positioning strategies
   - Mobile-optimized chip sizing and spacing
   - Portrait/landscape orientation handling

3. **Performance Optimizations**

   - Virtual scrolling for large documents
   - Web Workers for heavy calculations
   - Canvas-based rendering for many chips

4. **User Experience Enhancements**
   - User-configurable positioning preferences
   - Drag-and-drop chip repositioning
   - Animated transitions between positions

This specification provides a complete technical overview of the chip positioning system, serving as both documentation and implementation guide for future development and debugging efforts.
