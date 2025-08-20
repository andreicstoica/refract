# Highlight Components

This directory contains the refactored components for the theme highlighting functionality, extracted from the original `ThemeHighlightView.tsx` component.

## Architecture

The highlighting system has been broken down into focused, single-responsibility components:

### Components

- **`HighlightedText.tsx`** - Renders text with animated highlights using Framer Motion
- **`ThemeSelector.tsx`** - Handles theme selection UI with scrollable buttons
- **`LoadingState.tsx`** - Simple loading state component
- **`index.ts`** - Barrel export for clean imports

### Hooks

- **`useThemeHighlightData.ts`** - Custom hook for data loading and state management

### Utilities

- **`highlightUtils.ts`** - Pure functions for text processing and range calculations
- **`types/highlight.ts`** - TypeScript types for highlighting functionality

## Benefits of Refactoring

1. **Separation of Concerns**: Each component has a single, clear responsibility
2. **Reusability**: Components can be easily reused in other parts of the application
3. **Testability**: Smaller components are easier to unit test
4. **Maintainability**: Changes to one aspect don't affect others
5. **Readability**: The main component is now much cleaner and easier to understand
6. **Performance**: Optimized range calculations using pre-computed embeddings data

## Data Flow

1. `useThemeHighlightData` loads data from storage and manages state
   - Shows loading state while checking for saved content
   - Redirects to `/write` if no data is found
2. `ThemeSelector` handles user interactions for theme selection
3. `HighlightedText` receives processed data and renders the animated text
4. **Optimized range calculation**: Uses pre-computed sentence mappings from embeddings instead of re-calculating

## Usage

```tsx
import { ThemeHighlightView } from "@/components/ThemeHighlightView";

<ThemeHighlightView themes={themes} />;
```

The component automatically handles data loading, theme selection, and text highlighting with smooth animations.
