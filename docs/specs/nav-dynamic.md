# Dynamic Navigation Enhancement Specification

## Overview

Enhance the current AppNav component with dynamic reactivity inspired by motion-primitives' toolbar-dynamic pattern to provide better visual feedback about app state and available actions.

## Current State Analysis

The current `AppNav` component (`src/components/AppNav.tsx`) features:

- Simple two-tab navigation (Write/Analyze) 
- Static layout with centered tabs
- Analyze tab can be disabled when no content exists
- Clean but minimal visual feedback

## Proposed Enhancement: Dynamic Analyze Button

### Core Concept

Transform the static Analyze tab into a dynamic button that expands and contracts based on analysis readiness, similar to how the motion-primitives toolbar-dynamic search button expands when clicked.

### Dynamic States

#### State 1: Collapsed (No Content Available)
```tsx
// When no content exists to analyze
<motion.div animate={{ width: '48px' }}>
  <Button disabled>
    <Binoculars className="w-4 h-4 text-muted-foreground/50" />
  </Button>
</motion.div>
```

**Visual:** 
- Collapsed to icon-only button
- Grayed out icon
- Disabled state
- Width: 48px

#### State 2: Expanded (Ready to Analyze)  
```tsx
// When content exists and analysis is possible
<motion.div animate={{ width: 'auto' }}>
  <Button>
    <Binoculars className="w-4 h-4" />
    <span className="ml-2">Analyze</span>
  </Button>
</motion.div>
```

**Visual:**
- Expands to show icon + text
- Full color icon 
- Enabled state
- Width: auto (fits "Analyze" text)

#### State 3: Expanded but Disabled (Processing)
```tsx
// When analysis is in progress - keep expanded but disabled
<motion.div animate={{ width: 'auto' }}>
  <Button disabled>
    <Binoculars className="w-4 h-4 text-muted-foreground" />
    <span className="ml-2">Analyze</span>
  </Button>
</motion.div>
```

**Visual:**
- Maintains expanded width with "Analyze" text
- Grayed out icon and text
- Disabled state during processing
- No spinner (processing feedback handled by page LoadingState)

## Implementation Details

### Motion Configuration

```tsx
const transition = {
  type: 'spring',
  bounce: 0.1,
  duration: 0.2,
};
```

Use Framer Motion's spring animation for smooth, natural transitions between states.

### State Detection Logic

**Readiness Conditions:**
- Text content exists in the writing session
- At least one sentence has been processed
- Analysis is not currently running
- User has written for minimum threshold (e.g., 50+ characters)

**Current State Management (Preserve All Effects):**
```tsx
interface AppNavProps {
  active: "write" | "reflect";
  onTabChange: (tab: "write" | "reflect") => void;
  analyzeDisabled?: boolean; // Current prop - MUST preserve existing logic
  isProcessing?: boolean; // New: explicitly pass processing state
  className?: string;
}
```

**Enhanced State Detection:**
```tsx
// Write page calculates this exactly as before
const analyzeDisabled = !analyzeEnabled || isGenerating;

// New internal state for dynamic behavior
const hasContent = analyzeEnabled; // Content exists and timer conditions met
const isProcessing = isGenerating; // Analysis currently running

// Dynamic display logic
const shouldExpand = hasContent; // Expand when content available
const shouldDisable = !hasContent || isProcessing; // Disable when no content OR processing
```

### Layout Considerations

**Container Structure:**
```tsx
<div className="flex items-center justify-between max-w-2xl mx-auto">
  {/* Left: Write tab (always visible) */}
  <TabsTrigger value="write">
    <PencilLine className="w-4 h-4" />
    Write
  </TabsTrigger>
  
  {/* Right: Dynamic analyze button */}
  <MotionConfig transition={transition}>
    <motion.div animate={{ width: analyzeState === 'disabled' ? '48px' : 'auto' }}>
      {/* Dynamic analyze button content */}
    </motion.div>
  </MotionConfig>
</div>
```

### Mobile Optimization

**Responsive Behavior:**
- Maintain dynamic expansion on mobile devices
- No additional min-size constraints beyond default tab sizing
- Smooth animations optimized for mobile GPUs
- Consider reduced motion preferences

## Critical State Effects That Must Be Preserved

### Write Page Complex State Flow

**Timer-Based Enable Logic (lines 53-57):**
```tsx
// Enable analyze tab after 20 seconds OR when timer completes
setTimeout(() => {
  setAnalyzeEnabled(true);
}, 20000);

const handleTimerComplete = () => {
  setTimerCompleted(true);
  setAnalyzeEnabled(true); // Ensure analyze is enabled when timer completes
};
```
**PRESERVE:** The 20-second delay and timer completion logic must remain intact.

**Critical Navigation Effects (lines 64-84):**
```tsx
const handleTabChange = useCallback(
  async (tab: "write" | "reflect") => {
    if (tab === "reflect" && analyzeEnabled) {
      try {
        // 1. Clear stale data to prevent old themes showing
        storage.clear();
        
        // 2. Set analysis flag for themes page polling
        localStorage.setItem("refract-analysis", "running");

        // 3. Fire embeddings generation (async)
        generateEmbeddings(currentSentences, currentText);

        // 4. Navigate immediately (don't wait for completion)
        router.push("/themes");
      } catch (error) {
        console.error("❌ Failed to start analysis:", error);
      }
    }
  },
  [analyzeEnabled, currentSentences, currentText, router, generateEmbeddings]
);
```
**PRESERVE:** All four steps in exact order - clear, flag, generate, navigate.

**Body Scroll Lock (lines 87-98):**
```tsx
useEffect(() => {
  const originalOverflow = document.body.style.overflow;
  const originalHeight = document.body.style.height;

  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";

  return () => {
    document.body.style.overflow = originalOverflow;
    document.body.style.height = originalHeight;
  };
}, []);
```
**PRESERVE:** Full-height viewport lock for write page.

### Themes Page Polling System

**Analysis Detection (lines 22-29):**
```tsx
const analysisStatus = localStorage.getItem("refract-analysis");

if (analysisStatus === "running") {
  // Fresh analysis starting - clear old themes and show loading
  setThemes([]);
  setIsLoading(true);
  // ... polling logic
}
```
**PRESERVE:** The localStorage flag system and loading state management.

**Polling Mechanism with Timeout (lines 30-66):**
```tsx
// Poll every 500ms for up to 60 seconds
const pollInterval = setInterval(() => {
  const newThemes = storage.getThemes();
  // Success: set themes and clear analysis flag
}, 500);

// 60-second timeout with fallback
const timeout = setTimeout(() => {
  clearInterval(pollInterval);
  setIsLoading(false);
  localStorage.removeItem("refract-analysis");
  // Fallback to existing themes
}, 60000);
```
**PRESERVE:** The 500ms polling, 60s timeout, and fallback behavior.

### Storage Service Integration

**Embedding Hook Storage Effects:**
```tsx
// useGenerateEmbeddings saves results to localStorage
storage.setThemes(themes);
storage.setText(fullText);
storage.setSentences(sentences);
```
**PRESERVE:** The automatic storage of themes, text, and sentences.

## Integration Points

### Write Page Integration
- **NO CHANGES** to existing state management (`analyzeEnabled`, `isGenerating`)
- **NO CHANGES** to timer logic or navigation effects  
- **ONLY ADD** dynamic visual behavior based on existing `analyzeDisabled` prop

### Themes Page Integration  
- **NO CHANGES** to polling mechanism or loading states
- **NO CHANGES** to localStorage analysis flag system
- Page-level LoadingState component handles all processing feedback

## Visual Design

### Animation Timing
- **Expand**: 200ms spring animation when content threshold met
- **Contract**: 200ms spring animation when content cleared
- **State Change**: Instant icon/text transitions with smooth width changes

### Accessibility
- Maintain proper ARIA labels throughout state changes
- Analyze tab labels:
  - Collapsed, no content: `aria-label="Analyze (not ready)"`
  - Expanded, ready: `aria-label="Analyze"`
  - Expanded, processing: `aria-label="Analyze (processing)"`
- Preserve keyboard navigation functionality (keep Radix `TabsTrigger` semantics)
- Support reduced motion preferences

## Technical Implementation

### File Changes Required

**Primary Changes:**
- `src/components/AppNav.tsx`
  - Accept new `isProcessing?: boolean` prop
  - Add dynamic width animations only
  - Set `aria-label` on Analyze tab based on state
- Ensure framer-motion dependency available

**Integration Changes:**
- `src/app/write/page.tsx` - Pass `isProcessing` from `useGenerateEmbeddings().isGenerating`
- `src/app/themes/page.tsx` - Keep all existing polling and loading logic
- All existing hooks remain unchanged

### Dependencies

```json
{
  "motion": "^1.0.0", // or "framer-motion" if using legacy version
}
```

## Success Criteria

1. **Visual Feedback**: Users immediately understand when analysis becomes available
2. **Smooth Animations**: Transitions feel natural and responsive
3. **Performance**: No jank or layout shifts during animations  
4. **Accessibility**: Full keyboard and screen reader support maintained
5. **Mobile Experience**: Touch-friendly interactions on all screen sizes

## Future Enhancements

### Phase 2 Possibilities
- Word count indicator in collapsed state
- Progress indicator during analysis
- Subtle pulse animation when analysis becomes available
- Theme count badge on analyze button

### Advanced Interactions
- Hover states with preview information
- Long-press for analysis options
- Swipe gestures on mobile for quick navigation

## Notes

This enhancement maintains the clean, minimal aesthetic of the current nav while adding meaningful visual feedback about app state. The dynamic behavior helps users understand when they can progress to the analysis phase, improving the overall user experience without adding complexity to the interface.

The implementation leverages existing state management patterns and hooks, requiring minimal architectural changes while providing significant UX improvements.
