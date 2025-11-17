# Prod Cadence & Topic Guardrails

## ✅ Resolution (Fixed)
**Issue:** The `makeFingerprint()` collision-prone approach (first 30 chars + length) caused duplicate queue entries and missed similar sentences.

**Fix:** Replaced fingerprint-based deduplication with sentence ID-based deduplication in `useProdQueueManager`. Sentence IDs (`sentence-${startPos}-${contentHash}-${sentenceLength}`) are stable, content-based identifiers that:
- Include position (`startPos`) for uniqueness across identical sentences in different positions
- Include a 10-character normalized content hash from the first 20 chars
- Eliminate prefix/length collision issues completely

**Changed files:**
- `src/features/prods/hooks/useProdQueueManager.ts` - Now uses `sentence.id` instead of `makeFingerprint(text)` for enqueue guard
- `docs/architecture.md` - Updated to document sentence ID-based deduplication
- `docs/diagrams/prod-queue.mmd` - Updated diagram to reflect sentence ID usage

The layered deduplication approach remains the same:
- **Enqueue guard** (sentence ID, 15s/60s TTL) prevents duplicate queue entries
- **Display guard** (normalized text, 10s/30s TTL) prevents duplicate visible prods

## Problem (Historical Context)
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

## ~~Current~~ Former Fingerprinting Weakness (Historical - Now Fixed)
**Note:** This section documents the old approach for historical context. The system now uses sentence IDs instead.

The old `makeFingerprint()` function in `src/lib/dedup.ts` used a collision-prone approach: first 30 chars + total length (e.g., `"the quick brown fox jumps over-43"`).

**Known failure modes (resolved by using sentence IDs):**
1. **Semantic collisions** - sentences with identical prefixes and length but different endings collide:
	- "The quick brown fox jumps over the lazy dog" (44 chars)
	- "The quick brown fox jumps over the lazy cat" (44 chars)
	- Same fingerprint → second one wrongly skipped

2. **Paraphrase bypass** - semantically identical thoughts with different wording both trigger:
	- "I love coding in TypeScript"
	- "TypeScript is great for coding"
	- Different fingerprints → duplicate prods for same intent

3. **Mid/end edits bypass cache** - editing past char 30 with same length reprocesses as new:
	- "The introduction to this essay discusses the main themes"
	- "The introduction to this essay explores the core concepts"
	- Same 30-char prefix, similar length → may slip through

**Why this matters:** The fingerprint TTL (15s normal, 60s demo) only prevents *exact* spam in a narrow window. It won't catch the "four identical prods" issue if the LLM generates similar outputs from paraphrased inputs.

**Better alternatives (✅ Implemented):**
- ✅ **Sentence IDs** - Now using stable content-based identifiers (`sentence-${startPos}-${contentHash}-${sentenceLength}`) that include position + normalized content hash + raw sentence length so IDs advance as punctuation-less thoughts keep growing
- Cosine similarity on sentence embeddings (infrastructure exists via `EmbeddingsProvider`, could be future enhancement)
- Proper content hash (MD5/SHA) of normalized text (similar to what sentence IDs provide)
- Fuzzy string matching (Levenshtein distance)

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
