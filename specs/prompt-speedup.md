# Prompt Speed Optimization Spec

## Current Performance Issue

API response times are too slow for good UX:

- Current: 12-32 seconds per sentence
- Target: <3 seconds per sentence
- Root cause: Two sequential AI calls (generate + select) within `/api/prod`

## Observed Timings

```
POST /api/prod 200 in 27292ms
POST /api/prod 200 in 15078ms
POST /api/prod 200 in 32543ms
POST /api/prod 200 in 12021ms
POST /api/prod 200 in 12523ms
```

## Optimization Strategies

### 1. Reduce AI Model Calls

**Goal**: Cut response time in half by eliminating dual AI calls

- **Single-stage prompting**: One AI call that directly generates the best prod (no candidate generation)
- **Smaller/faster models**: Use `gpt-5-nano` instead of `gpt-5-mini`
- **Prompt optimization**: Reduce token count in system prompts for faster processing
- **Response streaming**: Start showing results as they're generated

### 2. Parallel AI Processing

**Goal**: Process multiple sentences simultaneously

- **Concurrent generation**: Generate prods for multiple sentences at once
- **Batch API calls**: Send multiple sentences in one request
- **Background processing**: Continue generating while user types

### 3. Smart Caching & Templates

**Goal**: Avoid AI calls for common patterns

- **Similarity caching**: Cache responses for similar sentence patterns
- **Context-aware cache**: "I'm happy about X" patterns get cached responses
- **Template-based fallbacks**: Pre-written prods for common sentence types
- **Progressive enhancement**: Show template immediately, replace with AI result

### 4. Model & Architecture Optimization

**Goal**: Fundamental speed improvements

- **Fine-tuned model**: Train smaller, specialized model for prod generation
- **Hybrid approach**: Templates + AI enhancement only for complex cases
- **Response prioritization**: Fast generic prod first, better AI prod replaces it
- **Streaming UI**: Show partial results as they generate

### 5. Advanced Techniques

**Goal**: Research-level optimizations

- **Prompt caching**: Cache common prompt segments
- **Model quantization**: Use faster quantized models
- **Edge deployment**: Deploy models closer to users
- **Speculative execution**: Start generating before user finishes typing

## Implementation Priority

1. **Quick wins** (1-2 days): Single-stage prompting, smaller models
2. **Medium effort** (1 week): Caching, templates, batching
3. **Research** (ongoing): Fine-tuning, edge deployment

## Success Metrics

- Response time: <3 seconds average (vs current 12-32s)
- User experience: Prods appear while typing
- Quality maintenance: Keep current prod relevance/tone

## Future Considerations

- User feedback on speed vs quality tradeoffs
- Cost implications of different model choices
- Scalability with more users
