# Embeddings & Semantic Clustering Spec

## Overview

Transform the reflective writing experience by adding semantic analysis and mindmap-style visualization. After users complete a writing session, generate embeddings to identify key themes and present them as interactive "bubbles" that reveal related content when tapped.

## User Experience Flow

1. **Writing Phase** - User writes continuously in the existing interface
2. **Threshold Detection** - "Done" button appears after 1000+ characters written
3. **Processing** - User taps "Done" -> system generates embeddings and clusters content
4. **Bubble Visualization** - 2-3 theme bubbles appear showing most common topics found
5. **Exploration** - Tap bubbles -> animated expansion reveals text segments related to that theme

## Technical Architecture

### Embedding Generation

- **Library**: Vercel AI SDK (`embed`, `embedMany`, `cosineSimilarity`)
- **Model**: OpenAI `text-embedding-3-small` (cost-efficient, good quality)
- **Chunking Strategy**: **Reuse existing sentence processing** from `useProds.ts`
  - Leverage `splitIntoSentences()` from `sentenceUtils.ts`
  - Consider applying existing `shouldProcessSentence()` filtering logic (skips short/filler content)
  - Cache processed sentences from prod API calls during writing session
- **Batch Processing**: Use `embedMany` for efficient parallel processing

### Clustering Approach

- **Similarity Calculation**: `cosineSimilarity` from AI SDK
- **Grouping**: Simple k-means or hierarchical clustering (k=2-3 themes)
- **Theme Labeling**: Use existing LLM setup to generate concise theme names
- **Relevance Filtering**: Only show themes with sufficient content/confidence

### Data Flow

```
Text Input -> Existing Sentence Processing (useProds) -> Cache Filtered Sentences ->
"Done" Button -> Embed Cached Sentences -> Clustering -> Theme Extraction -> Bubble UI
```

### Optimization: Leverage Existing Prods Infrastructure

- **Sentence Processing**: Already done during writing via `useProds.ts`
- **Quality Filtering**: `shouldProcessSentence()` eliminates noise (short text, filler, etc.)
- **Caching Strategy**: Store filtered sentences during writing session
- **Efficiency Gain**: Only embed meaningful content that already passed prod filtering
- **Consistency**: Same sentence boundaries used for both prods and embeddings

## UI/UX Specifications

### Done Button

- **Trigger**: Appears when text length > 1000 characters
- **Position**: Bottom of writing area, non-intrusive
- **Style**: Consistent with existing writing aesthetic - gentle introduction animation
- **Behavior**: Single tap -> processing state -> results view

### Theme Bubbles

- **Count**: Show top 2-3 themes maximum
- **Design**: Floating, organic bubble shapes (think GSAP/ThreeJS/OpenAI talk mode sphere)
- **Content**: Theme name + confidence indicator (just for debug)
- **Positioning**: Scattered mindmap-style layout
- **Animation**: Smooth entrance with stagger effect

### Expansion Interaction

- **Trigger**: Tap on any bubble
- **Animation**: Bubble expands, reveals related text segments
- **Content Display**: Original text with highlighting for relevant portions
- **Navigation**: Easy return to bubble overview

## Implementation Phases

### Phase 1: Core Infrastructure

- [x] Create `embeddingUtils.ts` with embedding functions (chunking already exists)
- [x] Extend `useProds.ts` to cache filtered sentences for embedding reuse
- [x] Create `/api/embeddings` endpoint using Vercel AI SDK
- [x] Add basic clustering utilities with `cosineSimilarity`

### Phase 2: Done Button Integration

- [x] Create `DoneButton` component with character threshold logic
- [x] Integrate with existing `TextInput` component
- [x] Add processing states and feedback

### Phase 3: Clustering & Theme Detection

- [x] Implement semantic clustering algorithms
- [x] Add theme labeling using existing LLM integration
- [x] Store and manage cluster results

### Phase 4: Bubble Visualization

- [ ] Create `ThemeBubble` components with animations and visual texture
- [ ] Build mindmap layout system
- [ ] Implement expansion interactions and text highlighting
- [ ] Add smooth transitions between views

## Technical Requirements

### Dependencies

- **No new packages needed** - use existing Vercel AI SDK
- **Existing tools**: Framer Motion and GSAP for animations, current state patterns

### API Endpoints

```
POST /api/embeddings
{
  "text": "full writing content",
  "chunks": ["chunk1", "chunk2", ...]
}

Response:
{
  "embeddings": [...],
  "clusters": [...],
  "themes": ["theme1", "theme2", "theme3"],
  "usage": { tokens: 150, cost: 0.002 }
}
```

### State Management

- Extend existing React state pattern
- Store: `embeddings`, `clusters`, `themes`, `selectedTheme`
- Lifecycle: Generate on "Done", persist during session, clear on new writing

## Performance Considerations

- **Minimum viable text**: 1000+ characters (updated threshold) ensures meaningful clustering
- **Chunking strategy**: Balance between context and embedding efficiency
- **Rate limiting**: Reuse existing patterns from prod API
- **Caching**: Consider session-based caching for repeated analysis

## Acceptance Criteria

### MVP Success Metrics

- [x] "Done" button appears reliably at 1000+ character threshold
- [x] Embedding generation completes within 3-5 seconds for typical content
- [x] 2-3 meaningful themes identified for most writing sessions
- [ ] Bubble interactions feel smooth and responsive
- [ ] Text highlighting accurately shows theme-related content

### User Experience Goals

- **Seamless transition**: From writing to analysis feels natural
- **Meaningful insights**: Themes reflect actual content patterns
- **Engaging interaction**: Bubble exploration encourages deeper reflection
- **Performance**: No noticeable delays or jarring transitions

## Future Enhancements (Out of Scope)

- Cross-session theme tracking and evolution
- More sophisticated clustering algorithms (UMAP, HDBSCAN)
- Voice-to-text integration with semantic analysis
- Export capabilities for mindmaps and insights
- Integration with external knowledge bases

## Integration Points

### Existing Components

- **TextInput**: Add done button and trigger embeddings
- **Chip system**: Consider relationship between prods and themes
- **Animation framework**: Leverage Framer Motion for bubble interactions

### Existing APIs

- **Prod API**: Similar pattern for LLM calls and response handling
- **State patterns**: Follow established React state management

This spec provides the foundation for implementing semantic clustering while maintaining consistency with the existing reflective writing experience.
