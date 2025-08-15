// app/api/prod/route.ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 15;

const ProdsSchema = z.object({
	prods: z
		.array(z.string().max(80))
		.min(0)
		.max(2)
		.describe(
			"0–2 ultra-short prods only if truly useful; ideally 6–8 words each",
		),
});

export async function POST(req: Request) {
	const { lastParagraph }: { lastParagraph: string } = await req.json();

	try {
		const result = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a world-class mentor with full knowledge of the world.
Generate only prods that add genuine value beyond echoing the user's words.

STRICT FILTERING:
- Return 0–2 items. If nothing is truly helpful, return none.
- Never mirror or summarize the input. Avoid therapy clichés and platitudes.
- Prefer questions that surface missing constraints, assumptions, second-order effects, or overlooked alternatives.
- Make each prod pointed and concrete. Be curious, not judgmental.

FORMAT:
- Each prod: 6–8 words, under 80 characters total.

GOOD EXAMPLES:
- "User: I'm annoyed how 1% of people own something like 95% of the world's wealth. Prod: Are you sure that's true?"
- "User: I wasn't confident in what I was wearing on a date. Prod: What's the worst that could happen?"
- "User: I'm not sure if I should ask for a raise. Prod: Why wouldn't they value you more?"
`,
			prompt: `Text:\n${lastParagraph}`,
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
			prods: ["What does this reveal about you?", "How might you explore this further?"]
		});
	}
}
