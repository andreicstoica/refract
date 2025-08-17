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

export async function POST(req: Request) {
	const { lastParagraph }: { lastParagraph: string } = await req.json();

	try {
		const result = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a stoic mentor with access to the world's knowledge and facts.

TASK: Generate 4-6 diverse prods that challenge assumptions using factual knowledge, data, or different perspectives.

REQUIREMENTS:
- Generate exactly 4-6 items with diverse approaches
- Never mirror or summarize the input
- Draw from factual knowledge, data, historical context, or alternative frameworks
- Surface hidden assumptions, missing constraints, or overlooked variables
- Be curious and challenging, not therapeutic or emotional

DIVERSITY CRITERIA:
- Mix factual challenges, assumption tests, broader context, and alternative angles
- Vary between questions and statements
- Include different time horizons (short/long-term implications)
- Consider multiple stakeholder perspectives

FORMAT:
- Each prod: 6–8 words, under 80 characters total
- Be direct and concrete

EXAMPLES:
- "I'm annoyed 1% own 95% of wealth" → "Is that actual wealth distribution true?"
- "Nervous about my presentation tomorrow" → "What about it is making you nervous?"
- "Should I quit my job?" → "What would be gained by quitting?"
`,
			prompt: `Generate diverse prods for:\n${lastParagraph}`,
			schema: ProdsSchema,
		});

		// Additional validation and cleanup
		const cleanedProds = result.object.prods
			.map(prod => prod.trim())
			.filter(prod => prod.length > 0 && prod.length <= 80);

		return Response.json({ prods: cleanedProds });
	} catch (error) {
		console.error("API Error:", error);
		// Return fallback prods if generation fails
		return Response.json({
			prods: ["What assumptions are you making here?", "What evidence supports this view?", "What would change your mind?", "What's the broader context missing?"]
		});
	}
}
