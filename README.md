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

## Technical Plan

- Frontend: Next.js 15 (App Router), React 19, Tailwind, Framer Motion, GSAP
- Language Processing:
  - Sentence chunking + small, fast embeddings (OpenAI text-embedding-3-small).
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
