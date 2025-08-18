// app/api/prod/route.ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 15;

const ProdsSchema = z.object({
	prods: z
		.array(z.string().max(80))
		.min(2)
		.max(6)
		.describe(
			"4–6 diverse, high-quality prods; ideally 6–8 words each",
		),
});

const SelectionSchema = z.object({
	selectedProd: z.string().optional().describe("The best prod from candidates, or empty if none are relevant"),
	confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
	shouldSkip: z.boolean().describe("True if this sentence doesn't warrant a prod"),
});

export async function POST(req: Request) {
	const { lastParagraph, fullText }: { lastParagraph: string; fullText?: string } = await req.json();

	try {
		// Stage 1: Generate candidate prods
		const generationResult = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a thoughtful mentor who helps people explore ideas with curiosity and nuance.

TASK: Generate 4-6 diverse prods that encourage deeper thinking while respecting the emotional tone of the original text.

REQUIREMENTS:
- Generate exactly 4-6 items with diverse approaches
- Never mirror or summarize the input
- RESPECT EMOTIONAL CONTEXT: Match the energy and sentiment of the original
- For positive statements: Ask growth/insight questions, not deficit-focused ones
- For struggles: Offer exploration without being dismissive
- Be genuinely curious, not critical or negative

TONE GUIDELINES:
- Positive experiences → Explore what made them meaningful
- Celebrations → Understand the deeper value
- Struggles → Examine patterns or alternatives constructively
- Neutral observations → Challenge assumptions with facts/data

DIVERSITY CRITERIA:
- Mix insight questions, assumption tests, broader context, and alternative angles
- Vary between questions and statements
- Include different time horizons when relevant
- Consider multiple perspectives

FORMAT:
- Each prod: 6–8 words, under 80 characters total
- Be direct but respectful of emotional context

EXAMPLES:
- "Had a slow morning, which was really nice" → "What made it feel especially restorative?"
- "Stressed about presentation tomorrow" → "What about it is making you nervous?"
- "Should I quit my job?" → "What would be gained by quitting?"
`,
			prompt: `Generate diverse prods for:\n${lastParagraph}`,
			schema: ProdsSchema,
		});

		// Clean up generated prods
		const candidateProds = generationResult.object.prods
			.map(prod => prod.trim())
			.filter(prod => prod.length > 0 && prod.length <= 80);

		if (candidateProds.length === 0) {
			return Response.json({
				selectedProd: "",
				shouldSkip: true,
				confidence: 0
			});
		}

		// Stage 2: Select the best prod
		const selectionResult = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a thoughtful selection system that picks the most insightful prod while respecting emotional context.

TASK: Select the single best prod that encourages deeper thinking while honoring the tone of the original sentence.

SELECTION CRITERIA (in order of priority):
1. TONE ALIGNMENT: Respects the emotional context and sentiment of the sentence
2. INSIGHT POTENTIAL: Likely to reveal meaningful patterns or understanding
3. CONTEXT RELEVANCE: Fits the specific sentence while considering the broader text
4. GROWTH ORIENTATION: Encourages exploration without being critical or negative
5. UNIQUENESS: Avoids generic or repetitive patterns

APPROACH:
- Be thoughtfully selective - pick the one that adds most meaningful value
- For positive experiences: Choose prods that explore deeper meaning, not problems
- For struggles: Choose supportive exploration over harsh questioning
- For neutral observations: Gentle fact-checking or alternative perspectives
- Consider both immediate sentence context and document-wide themes
- IMPORTANT: Set shouldSkip=true if the sentence is too mundane or doesn't warrant analysis

OUTPUT:
- Select exactly one prod OR set shouldSkip=true for irrelevant sentences
- Provide confidence (0.7+ for strong selections, 0.5-0.7 for decent, <0.5 for weak)
- Use shouldSkip=true for: simple facts, mundane observations, already complete thoughts`,
			prompt: `${fullText ? `DOCUMENT CONTEXT:\n${fullText}\n\n` : ''}TARGET SENTENCE:\n"${lastParagraph}"\n\nCANDIDATE PRODS:\n${candidateProds.map((prod, i) => `${i + 1}. ${prod}`).join('\n')}\n\nSelect the best prod:`,
			schema: SelectionSchema,
		});

		// Return the selected result
		const selection = selectionResult.object;

		return Response.json({
			selectedProd: selection.selectedProd || "",
			shouldSkip: selection.shouldSkip || false,
			confidence: selection.confidence || 0
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
