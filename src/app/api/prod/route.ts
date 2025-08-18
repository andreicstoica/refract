// app/api/prod/route.ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 15;

const ProdResponseSchema = z.object({
	selectedProd: z.string().optional().describe("Best single prod or empty if skipping"),
	shouldSkip: z.boolean().describe("True if sentence doesn't merit a prod"),
	confidence: z.number().min(0).max(1).describe("0–1 confidence score"),
});

export async function POST(req: Request) {
	const { lastParagraph, fullText }: { lastParagraph: string; fullText?: string } = await req.json();

	try {
		// Truncate fullText to last 400 characters for efficiency
		const truncatedContext = fullText ? fullText.slice(-400) : "";

		const result = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a thoughtful mentor who helps people explore ideas with curiosity and nuance.

TASK: Internally brainstorm 4-6 diverse candidate prods, evaluate them, and output only the single best prod with a confidence score.

REQUIREMENTS:
- Respect emotional context and match the tone of the original text
- For positive statements: Ask growth/insight questions, not deficit-focused ones
- For struggles: Offer exploration without being dismissive
- Be genuinely curious, not critical or negative
- Each prod: 6–8 words, under 80 characters total
- Never mirror or summarize the input

SELECTION CRITERIA (in order of priority):
1. TONE ALIGNMENT: Respects the emotional context and sentiment
2. INSIGHT POTENTIAL: Likely to reveal meaningful patterns or understanding
3. CONTEXT RELEVANCE: Fits the specific sentence while considering broader text
4. GROWTH ORIENTATION: Encourages exploration without being critical
5. UNIQUENESS: Avoids generic or repetitive patterns

IMPORTANT: Set shouldSkip=true if the sentence is too mundane, factual, or already complete.

EXAMPLES:
- "Had a slow morning, which was really nice" → "What made it feel especially restorative?"
- "Stressed about presentation tomorrow" → "What about it is making you nervous?"
- "Should I quit my job?" → "What would be gained by quitting?"`,
			prompt: `${truncatedContext ? `DOCUMENT CONTEXT:\n${truncatedContext}\n\n` : ''}TARGET SENTENCE:\n"${lastParagraph}"\n\nReturn only JSON per schema.`,
			schema: ProdResponseSchema,
		});

		return Response.json({
			selectedProd: result.object.selectedProd || "",
			shouldSkip: result.object.shouldSkip ?? false,
			confidence: result.object.confidence ?? 0
		});

	} catch (error) {
		console.error("API Error:", error);
		// Return fallback response if generation fails
		return Response.json({
			selectedProd: "What made this significant to you?",
			shouldSkip: false,
			confidence: 0.5
		});
	}
}
