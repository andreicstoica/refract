# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**

- `bun dev` - Start development server on port 3001 with Turbopack
- `bun build` - Build production bundle
- `bun start` - Start production server

**Code Quality:**

- `bun run lint` - Run Biome linter with auto-fix (`biome check --write .`)
- `bun run format` - Format code with Biome (`biome format --write .`)

**Testing:**

- `bun test` - Run all tests with Bun test runner
- `bun test --watch` - Run tests in watch mode

## Project Architecture

**Core Concept:** Refract is a real-time journaling tool that provides AI-powered "prods" (contextual suggestions) as users write, then visualizes thoughts as interactive semantic bubble clusters.

### Key System Components

**Real-time Writing Flow:**

1. **Text Processing Pipeline:** User writes → sentence chunking (compromise.js) → embedding generation → k-means clustering
2. **AI Prod System:** Triggers on typing pauses/punctuation → sends text context to `/api/prod` → displays inline chips near relevant sentences
3. **Visualization:** Embeddings clustered using k-means, positioned in circular layout with organic randomization as interactive bubbles on themes page

**Data Flow Architecture:**

- `TextInput` component handles real-time text processing and sentence boundary detection
- `useGenerateEmbeddings` hook manages embedding pipeline and storage
- `useProds` hook handles prod generation with anchor-based positioning
- `ChipOverlay` uses ResizeObserver and scroll tracking for efficient chip positioning
- Chips anchored to cursor positions instead of dynamic sentence spans for stable placement

### Project Structure

**Core Pages:**

- `/write` - Main writing interface with TextInput and real-time prods
- `/themes` - Interactive bubble map visualization of semantic clusters
- `/` - Landing page

**Key Utilities:**

- `sentenceUtils.ts` - Text chunking and sentence boundary detection
- `embeddingUtils.ts` - Embedding generation and clustering logic
- `positionUtils.ts` - Anchor-based positioning system using modern browser APIs
- `prodSelectors.ts` - Logic for selecting relevant text context for prods

**API Endpoints:**

- `/api/embeddings` - Generates embeddings for text chunks
- `/api/prod` - Returns contextual writing prods based on recent text

### Technical Specifications

**Embedding Strategy:**

- Small, fast embeddings for real-time processing
- Batched calls with debouncing (3s idle + punctuation triggers)
- Maximum 1 call every 7 seconds to prevent API spam

**Mobile-First Design:**

- Single-column Write Mode and full-screen Map Mode
- Thumb-friendly interactions with large tap targets
- Responsive animations optimized for mobile GPUs

**Performance Optimizations:**

- Pre-warm embedding calls on first keystroke
- Optimized for short writing sessions (5-10 minutes)
- Smooth DOM-based animations with Framer Motion
- ResizeObserver for efficient chip positioning updates
- Anchor-based positioning prevents jarring chip movements during text reflow
- Future: Matter.js for gentle bubble physics, PixiJS for advanced interactions

## Code Style & Conventions

**TypeScript Paths:** Use configured aliases (`@/components/*`, `@/hooks/*`, `@/services/*`, `@/types/*`, `@/utils/*`)

**Biome Configuration:**

- Tab indentation, double quotes, semicolons as needed
- Sorted Tailwind classes with `cn()`, `clsx()`, `cva()` functions
- Strict linting with custom rules for parameter assignment and enum initialization

**Component Patterns:**

- Client components use "use client" directive
- Custom hooks for complex state management (`useGenerateEmbeddings`, `useProds`, `useTextProcessing`)
- Separation of UI components from business logic

## Development Notes

**Current State:** Project has completed core writing interface with improved anchor-based chip positioning system. Recent improvements include stable chip placement that prevents jarring movements during text reflow. Focus areas include semantic clustering, bubble visualization, and performance optimization.

**Key Dependencies:**

- Next.js 15 with App Router and React 19
- Vercel AI SDK with OpenAI integration
- Compromise.js for natural language processing
- Framer Motion for animations
- Bun as runtime and package manager

**Testing:** Uses Bun test runner with tests in `/tests` directory. Component tests use `.test.tsx` extension.

**Conventions:** Use defense programming practices when it makes sense. Limit use of complex state management. Type everything and don't use any/null when at all possible.
