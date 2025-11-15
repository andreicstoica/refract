# Prod Cadence & Topic Guardrails

## Problem
- Recent demo/prod sessions generated the identical prod four times consecutively for the same fragment of text.
- Current cadence gating only considers sentence-level triggers (punctuation + char threshold) and a global cooldown, so similar thoughts inside a short paragraph all enqueue immediately.
- Topic detection only resets the queue when *large* shifts occur, so micro-shifts or same-topic reiterations still spam the user.

## Goals
1. Keep prods helpful but discreet — target ≤1 prod per distinct sentence/topic cluster.
2. Understand whether recent regressions stem from logic drift in `useProdTriggers` / `useProds` vs. earlier branches.
3. Document reproducible behaviors so we can reintroduce guardrails with confidence.

## Current Behavioral Snapshot
- `useProdTriggers` (in-flight refactor inside `TextInput`) uses punctuation and char counts to enqueue; it does not know about topics beyond the boolean `hasTopicShift`.
- `useProds` dedupes *per sentence* but not across semantically similar sentences. Once sentence IDs change, the dedupe resets.
- Prompt inputs (`recentProds`, `lastParagraph`) lack negative feedback like "already showed this topic."

## Investigation Plan
1. **Diff core hooks**
	- Compare `src/features/prods/hooks/useProds.ts` and `src/features/prods/hooks/useProdTriggers.ts` (or legacy `useTextProcessing`) with the last known-good branch.
	- Focus on queue reducer defaults, dedupe fingerprints, and rate limiter inputs that might have regressed.
2. **Trace trigger lifecycle**
	- Instrument `TextInput` to log sentence IDs, trigger reasons (punctuation vs. char threshold), and whether topic shift resets fire.
	- Confirm whether `hasTopicShift` toggles for small micro-shifts or if the boolean is stuck false in the new branch.
3. **Review prompt payloads**
	- Capture real network requests to `/api/prod` and compare against previous deploy to ensure `recentProds`, `lastParagraph`, and other fields match.
4. **Manual reproduction**
	- Use the same demo text that produced four identical prods, record timestamps, and verify queue events to narrow down whether duplication happens before or after the API.

## Investigation Deliverables
- Side-by-side summary of behavioral differences between branches (trigger counts, queue size, API payloads).
- Notes on any logic that now bypasses dedupe (e.g., new sentence IDs or missing fingerprints).
- Recommendation on whether fixes can be incremental or need a rollback.

## Proposed Enhancements (post-investigation)
- Topic bucket memory to remember what was just surfaced and bias against repeats.
- Prompt-level recent-topic metadata so the API can diversify suggestions without relying on cooldowns.
- Optional telemetry hook to capture how often suppression logic fires once reinstated.

## Success Criteria
- Manual test: type 5 similar sentences; only the first should spawn a prod, others only if the user pauses >5s.
- Logging shows `topicBucket` coverage stays below ~3 buckets per minute during concentrated writing.
- Writers report fewer repetitive nudges without feeling abandoned (subjective demo feedback).
