// app/api/selection/route.ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 15;

// TODO: Consider using explicit reasoning mode when available in Vercel AI SDK

const SelectionSchema = z.object({
	selectedProd: z.string().describe("The best prod from the candidates"),
	confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
});

export async function POST(req: Request) {
	const { 
		text, 
		sentence, 
		prods, 
		sentenceId 
	}: { 
		text: string; 
		sentence: string; 
		prods: string[]; 
		sentenceId: string; 
	} = await req.json();

	if (!prods || prods.length === 0) {
		return Response.json({
			selectedProd: "",
			confidence: 0
		});
	}

	if (prods.length === 1) {
		return Response.json({
			selectedProd: prods[0],
			confidence: 0.8
		});
	}

	try {
		const result = await generateObject({
			model: openai("gpt-5-mini"),
			system: `You are a stoic selection system that picks the most impactful prod from candidates.

TASK: Select the single best prod that challenges assumptions using factual knowledge and broader context.

SELECTION CRITERIA (in order of priority):
1. FACTUAL GROUNDING: Draws from real data, research, or documented knowledge
2. ASSUMPTION TESTING: Challenges underlying beliefs or unstated premises  
3. CONTEXT RELEVANCE: Fits the specific sentence while considering the broader text
4. COGNITIVE IMPACT: Likely to provoke deeper, more rigorous thinking
5. UNIQUENESS: Avoids generic or repetitive patterns

APPROACH:
- Be ruthlessly selective - pick the one that adds most intellectual value
- Prefer prods that surface hidden constraints or missing variables
- Favor questions that make the user examine their evidence or logic
- Avoid therapy-style or purely emotional responses
- Consider both immediate sentence context and document-wide themes

OUTPUT:
- Select exactly one prod
- Provide confidence (0.7+ for strong selections, 0.5-0.7 for decent, <0.5 for weak)`,
			prompt: `DOCUMENT CONTEXT:
${text}

TARGET SENTENCE:
"${sentence}"

CANDIDATE PRODS:
${prods.map((prod, i) => `${i + 1}. ${prod}`).join('\n')}

Select the best prod:`,
			schema: SelectionSchema,
		});

		return Response.json(result.object);
	} catch (error) {
		console.error("Selection API Error:", error);
		// Fallback to first prod if selection fails
		return Response.json({
			selectedProd: prods[0],
			confidence: 0.5
		});
	}
}