# Refract

Graduation demo project for Fractal Tech's AI Engineering Finishing School.

## Project Spec: Build Your Dream Demo

### Description

Web-based journaling tool that annotates your writing in real time with short “chips” (e.g. _why did this feel annoying?_), then clusters your thoughts into animated semantic bubbles you can tap to explore.

## Project Requirements (Compliance)

- Mobile-first: single-column Write Mode and full-screen Map Mode, thumb-friendly interactions.
- Real domain: will deploy to a custom domain for Demo Day.
- Delightful UX + polished design: responsive animations, crisp chips, tasteful motion.
- Truly functional: strangers can write an entry on mobile, see chips, and explore the map.
- Wow factor: real‑time “computer reacts to you” + animated bubble map with smooth projection morph.
- Limited scope: one-session journaling → interactive map; no auth, no long-term persistence.

## Features

- Inline Focus Chips: sentence-level analysis triggers on pauses/punctuation; 1–2 tappable chips guide the next thought.
- Interactive Idea Map: entry is embedded, clustered into semantic themes using k-means, and displayed as 2D bubbles sized by confidence; tapping reveals phrases and targeted prompts.
- Meta-Reflection: tracks interaction patterns (e.g., ignored chips) and offers a tailored challenge next session/day.
- Semantic Bubble Layout: circular positioning with organic randomization creates natural, explorable clusters.
- Mobile-first Design: optimized for thumb use, large tap targets, responsive motion.
- Parallel Prod Queue: up to two prod requests run concurrently on `/write` (three on `/demo`) and fall back to cached pins, so new chips land even if one API call hits the full timeout window.

## Technical Plan

- Frontend: Next.js 15 (App Router), React 19, Tailwind, Framer Motion, GSAP
- Language Processing:
  - Sentence chunking + small, fast embeddings (OpenAI text-embedding-3-small).
  - Prod generation: `/api/prod` defaults to `gpt-5-mini` (overridable via `OPENAI_PROD_MODEL`) with 15 s timeouts and client-side cancellations.
  - Clustering: k-means with cosine similarity; theme labels via LLM refinement.
  - Layout: contextual positioning of UI elements to written text.
- Mobile:
  - Smooth DOM-based animations tuned for mobile (WIP).

## Scope

**In scope:** single-session journaling → interactive text area; inline chips, basic theme reflection; live deployment on custom domain.

**Out of scope:** multi-user auth; long-term storage beyond local/session; complex analytics or sentiment scoring.

## Challenges & Mitigations

- Limited wow factor: lean on interaction/motion polish; the "computer responds as you write" moment and semantic bubble exploration are the hook.
- Low-latency semantics: sentence batching + lightweight embeddings; slow mobile typing effectively increases slack.
- Appealing visualizations on mobile: mode separation (Write vs Map) and adaptive detail; circular bubble layout with natural spacing.
- Reactive UI under load: optimized for short sessions, smooth DOM animations, mobile-first performance.

## Quickstart

Install dependencies and start the dev server:

```bash
bun i
bun dev
```

Open http://localhost:3001 to develop.

## Project Structure

- `src/app/` – Next.js App Router layouts and route entries.
- `src/features/` – Vertical slices (writing, prods, ai, themes, ui). Each feature owns its hooks, providers, components, and any effectful helpers under `services/`.
- `src/lib/` – Framework-agnostic utilities (sentence parsing, chip math, highlight helpers, prod heuristics). Nothing here should touch fetch, localStorage, or timers.
- `src/components/` – Shared UI primitives that multiple features consume.
- `src/types/`, `src/index.css`, `docs/` – Global type definitions, Tailwind entrypoint, and long-form documentation/diagrams.

Pure-ish helpers stay in `src/lib`, while anything that talks to IO (fetch requests, AbortControllers, `localStorage`, DOM measurements) lives beside the feature that uses it under `src/features/*/services`.

## Prod Queue & Timing Highlights

- `useProdTriggers` fires `enqueueSentence` after punctuation/settling heuristics and arms a six-second watchdog. Once that watchdog forces a prod, the hook pauses additional triggers until the user types again, so idle sessions don’t churn requests.
- `useProdQueueManager` trims the pending list to the newest 3 items (`/write`) or 5 items (`/demo`), then launches as many API calls as the current parallel cap allows (2 or 3). Each request includes topic keywords, recent prods, and the latest topic version so stale responses are discarded.
- Client + server share a 15 s timeout; `generateProdWithTimeout` aborts any stragglers, and confidence gating still protects quality when the faster `gpt-5-mini` model replies quickly.

## Documentation

- `docs/architecture.md` details the writing flow (TimingConfigProvider, editor text pipeline, ProdsProvider) and links to diagrams.
- Store Mermaid sources under `docs/diagrams/` (see folder README) so reviewers can follow information-flow visuals without digging through code.

## Resources & Inspirations

- Building a Tactical Shooter with Text to Speech and AI — https://maryrosecook.com/blog/post/using-ai-to-build-a-tactical-shooter
- Mini environment game (Orb Farm) — https://orb.farm/
- Alien typewriter — https://synaut.itch.io/alien-typewriter
- Chrome Web Experiments — https://experiments.withgoogle.com/collection/chrome
- Stoic app
- Linus Lee / Ink & Switch
- Audio visualizers, concept visualizations
