# Project Spec: Reflective Writing Mirror

## Overall Goal

A distraction-free, continuous writing space where the user simply writes on a blank page, and the system surfaces gentle, contextual “prods” inline to encourage deeper thinking. Later, these could evolve into your chips and interactive semantic maps.

## Milestones

### ✅ Milestone 1 — Continuous Writing UI

Goal: Replace send-button chat with a freeform writing surface that fades upward as text accumulates.

UI changes

- Full-screen “page” with top fade (mask) so older text drifts out of focus.
- No input box; just a single contentEditable or textarea filling the main area.
- Typing flows continuously; line breaks allowed.
  Tech
- Next.js (App Router), Tailwind, Framer Motion for micro-animations.
- State holds the whole draft text.
- Auto-scroll to keep cursor in view.

Deliverable: User can open the app and just type, feeling like it’s a blank page.

Acceptance Criteria: Mobile first/friendly design

## ✅ Milestone 2 — Smart Chunk Sending & AI Prods

Goal: Send relevant slices of the draft to OpenAI API when meaningful pauses or sentence boundaries occur.

Trigger logic

- Idle debounce: e.g. 3 seconds after typing stops.
- Punctuation trigger: When ending a sentence (. ! ? ; :).
- Throttle: Never more than 1 call every ~7 seconds.
  Data to send
- Tail of the text (e.g., last 1–3 sentences, or ~500–1000 chars).
- Optional: keep a rolling buffer of recent context so the prod is relevant.
  API endpoint
- POST /api/prod → returns 1–2 short prods.
- System prompt: “Output 1–2 concise, specific prods based on the latest text. Max 8 words each.”

Deliverable: As you write and pause, small prods appear in the UI (even if not yet perfectly positioned inline)

## 👉 Milestone 3 — Inline / Anchored Chips

Goal: Position chips visually near the sentence they relate to, not in a static gutter.

Approach

- Split draft into sentences with indexes.
- When a prod comes in, associate it with the sentence index it was based on.
- Render a transparent overlay over the text area; measure the bounding box of the target sentence (using getBoundingClientRect() on a ref).
- Absolutely position chips near that sentence.
  Interaction
- Chips fade in; clickable in future (to expand into prompts, or insert into text).

Deliverable: Chips visually feel like they’re “pointing” to your last thought.

# Later (not yet in scope)

- Semantic/embeddings powered cluster map view on next page
- Meta-reflection challenges between sessions
- Voice dictation mode (Web Speech API)
- Clustering animations (PCA → UMAP via Canvas/WebGL)

# Existing Tech Stack

- Frontend: Next.js 14+, TailwindCSS, GSAP, Framer Motion
- Using bun as environment/package manager and biome for linting/tests
- LLM: Vercel AI SDK + OpenAI API (gpt-5-mini for low-latency)
- State: React state for local draft, chip store
- Text processing: sentence-split with compromise, sentence-splitter, or regex
- Positioning: React refs + DOM measurement (ResizeObserver, getBoundingClientRect)
- Consider using Effect

# Working With This Doc

- add 👉 to the milestone currently being worked on
- add ✅ to the milestone when I say it's done, and move to the next one
- only handle one milestone at a time
