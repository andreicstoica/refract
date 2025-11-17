# Diagram Sources

- Add Mermaid definitions (`*.mmd`) in this folder. Use lowercase, hyphenated filenames that match the feature area (e.g., `feature-flow.mmd`, `prod-queue.mmd`).
- Keep diagrams text-based; render assets (PNG/SVG) only when you need them for docs outside the repo.
- Reference diagrams from `docs/architecture.md` or other specs via relative paths so they preview on GitHub.
- Existing diagrams:
	- `feature-flow.mmd` — editor → hooks → providers → overlays.
	- `prod-queue.mmd` — queue state diagram (enqueue, pin, drop, reset).
	- `prod-triggers.mmd` — trigger heuristics + timers pushing sentences into the prod queue.
