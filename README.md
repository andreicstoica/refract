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
- Interactive Idea Map: entry is embedded, clustered, and projected into 2D bubbles sized by salience, labeled by theme; tapping reveals phrases and targeted prompts.
- Meta-Reflection: tracks interaction patterns (e.g., ignored chips) and offers a tailored challenge next session/day.
- Smooth Projection Morphing: instant PCA layout that morphs to UMAP when idle for clearer clusters.
- Mobile-first Design: optimized for thumb use, large tap targets, responsive motion.

## Technical Plan

- Frontend: Next.js 15 (App Router), React 19, Tailwind, GSAP; Canvas/WebGL as needed for 60fps bubble animations; mobile gestures (tap, long‑press drag, pinch zoom).
- Language Processing:
  - Sentence chunking + small, fast embeddings.
  - Clustering: k-means; labels via TF‑IDF with optional lightweight LLM refinement.
  - Projection: PCA for instant layout → UMAP for aesthetic cluster separation.
  - Optional Voice Input: Web Speech API for dictation/commands.
- Performance:
  - Batched + debounced embedding calls; pre-warm on first keystroke.
  - Cap visible nodes (top ~4 phrases for mobile).
  - Staged projection (PCA→UMAP) and incremental animation.

## Scope

**In scope:** single-session journaling → interactive map; inline chips, bubble map, basic meta-reflection; live deployment on custom domain.

**Out of scope:** multi-user auth; long-term storage beyond local/session; complex analytics or sentiment scoring.

## Challenges & Mitigations

- Limited wow factor: lean on interaction/motion polish; the “computer responds as you write” moment and morphing map are the hook.
- Low-latency semantics: sentence batching + lightweight embeddings; slow mobile typing effectively increases slack.
- Appealing projections on mobile: mode separation (Write vs Map) and adaptive detail; PCA→UMAP morph.
- Reactive UI under load: cap nodes, staged projections, motion tuned for mobile GPUs.

## Quickstart

Install dependencies and start the dev server:

```bash
bun i
bun dev
```

Open http://localhost:3001 to develop.

## Resources & Inspirations

- Building a Tactical Shooter with Text to Speech and AI — https://maryrosecook.com/blog/post/using-ai-to-build-a-tactical-shooter
- Mini environment game (Orb Farm) — https://orb.farm/
- Alien typewriter — https://synaut.itch.io/alien-typewriter
- Chrome Web Experiments — https://experiments.withgoogle.com/collection/chrome
- Stoic app
- Linus Lee / Ink & Switch
- Audio visualizers, concept visualizations
