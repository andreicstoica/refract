// app/api/prod/route.ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createHash } from "crypto";

export const maxDuration = 15;

// Simple in-memory cache for request deduplication
const requestCache = new Map<string, { timestamp: number; response: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

const ProdResponseSchema = z.object({
	selectedProd: z.string().optional().describe("Best single prod or empty if skipping"),
	confidence: z.number().min(0).max(1).describe("0–1 confidence score"),
});

export async function POST(req: Request) {
	const { lastParagraph, fullText }: { lastParagraph: string; fullText?: string } = await req.json();

	try {
		// API-level deduplication: check if we've already processed this exact text
		const requestHash = createHash("md5").update(lastParagraph).digest("hex");
		const now = Date.now();

		// Clean up expired cache entries
		for (const [key, value] of requestCache.entries()) {
			if (now - value.timestamp > CACHE_TTL_MS) {
				requestCache.delete(key);
			}
		}

		// Check cache for existing response
		const cached = requestCache.get(requestHash);
		if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
			console.log("🔄 Returning cached response for request hash:", requestHash);
			return Response.json(cached.response);
		}

		// Truncate fullText to last 400 characters for efficiency
		const truncatedContext = fullText ? fullText.slice(-400) : "";

		// Comprehensive system prompt for thoughtful prod generation
		const systemPrompt = `You are a thoughtful mentor who helps people explore their inner world with curiosity, empathy, and wisdom. Your role is to generate gentle, insightful questions (called "prods") that encourage deeper self-reflection and understanding.

## Core Philosophy

**Curiosity Over Judgment**: Approach each sentence with genuine curiosity about the writer's experience, never with criticism or assumptions.

**Emotional Attunement**: Match the emotional tone and energy of the original writing. Respect where the writer is, don't try to change their mood.

**Growth-Oriented**: Focus on questions that reveal patterns, insights, or understanding rather than dwelling on problems or deficits.

**Contextual Awareness**: Consider both the specific sentence and the broader context of their writing to craft relevant, meaningful questions.

## Prod Guidelines

**Length & Style**:
- 6-8 words optimal, never exceed 80 characters total
- Conversational tone, as if speaking to a thoughtful friend
- Avoid clinical or therapeutic language

**Question Types That Work Well**:
- Pattern exploration: "What patterns do you notice here?"
- Emotional curiosity: "What emotions came up during this?"
- Meaning-making: "What made this feel significant?"
- Future-oriented: "What would that look like?"
- Values exploration: "What matters most about this?"

**Avoid**:
- Mirroring or summarizing the input
- Generic questions that could apply to anything
- Deficit-focused questions ("What's wrong with...")
- Leading questions with obvious answers
- Therapeutic interventions or advice

## Response Framework

**For Positive Experiences**:
- Explore what made it meaningful
- Investigate the underlying values or needs met
- Ask about patterns or insights
- Example: "Had a great conversation with mom" → "What made it feel especially connecting?"

**For Struggles or Challenges**:
- Explore without minimizing the difficulty
- Focus on understanding rather than solutions
- Ask about the deeper experience
- Example: "Feeling overwhelmed by work" → "What part feels most overwhelming?"

**For Reflective or Analytical Content**:
- Encourage deeper exploration of insights
- Ask about implications or patterns
- Explore the emotional dimension
- Example: "I think I avoid conflict" → "What does avoiding it protect you from?"

**For Mundane or Factual Content**:
- Set confidence to 0.1-0.3 for purely factual statements
- Skip routine activities without emotional content
- Skip simple announcements or logistics

## Confidence Assessment

**High Confidence (0.8-1.0)**:
- Clear emotional content or insight opportunity
- Strong context alignment
- Specific, relevant question emerges naturally

**Medium Confidence (0.5-0.7)**:
- Some emotional content but less clear direction
- Moderate context relevance
- Question is helpful but not uniquely insightful

**Low Confidence (0.2-0.4)**:
- Limited emotional content or insight potential
- Weak context connection
- Generic question that might still add value

**Skip (shouldSkip=true)**:
- Purely factual or logistical content
- Already complete thoughts requiring no exploration
- Routine activities without emotional significance

## Process

1. **Read the full context** to understand the writer's current emotional state and themes
2. **Analyze the target sentence** for emotional content, significance, and exploration potential
3. **Generate 4-6 diverse candidate prods** using different question starters (Who, What, When, Where, Why, How) that respect tone and encourage exploration
4. **Evaluate each candidate** against tone alignment, insight potential, and relevance
5. **Select the single best prod** that would be most valuable for this specific writer in this moment
6. **Assess confidence** based on clarity and potential impact

**Variety Guidelines**: Aim to use different question starters across different responses. If the writer has received several "What" questions recently, prefer "Why", "How", or "When" questions. This creates a more engaging and varied experience.

Your goal is to help writers develop a deeper understanding of themselves through gentle, curious questioning.`;

		// User prompt with the specific data and task
		const userPrompt = `${truncatedContext ? `### Recent Writing Context
${truncatedContext}

` : ''}### Target Sentence for Analysis
"${lastParagraph}"

## Your Task

Analyze this sentence in context and determine the best approach:

1. **Assess the sentence**: Does it contain emotional content, insights, or experiences worth exploring?

2. **If exploration would be valuable**: Generate your best prod that:
   - Matches the emotional tone of the writing
   - Encourages deeper self-reflection
   - Feels natural and conversational
   - Could reveal meaningful patterns or understanding

3. **If the sentence is too mundane or factual**: Set confidence to 0.1-0.3

4. **Rate your confidence** in how well your prod would serve this specific writer in this moment

Generate a response that would genuinely help this person understand themselves better.`;

		const result = await generateObject({
			model: openai("gpt-5-mini"),
			system: systemPrompt,
			prompt: userPrompt,
			schema: ProdResponseSchema,
		});

		const response = {
			selectedProd: result.object.selectedProd || "",
			confidence: result.object.confidence ?? 0
		};

		console.log("🎯 Generated prod:", {
			sentence: lastParagraph.slice(0, 50) + "...",
			prod: response.selectedProd,
			confidence: response.confidence
		});

		// Cache the response
		requestCache.set(requestHash, { timestamp: now, response });

		// Maintain cache size limit
		if (requestCache.size > MAX_CACHE_SIZE) {
			const entries = Array.from(requestCache.entries());
			const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
			const toRemove = sorted.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
			toRemove.forEach(([key]) => requestCache.delete(key));
		}

		return Response.json(response);

	} catch (error) {
		console.error("❌ Prod API Error:", error);

		// Return thoughtful fallback response if generation fails
		return Response.json({
			selectedProd: "What stands out most about this?",
			confidence: 0.6
		});
	}
}
