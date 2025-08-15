// app/api/prods/route.ts
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 15;

export async function POST(req: Request) {
	try {
		const { lastParagraph }: { lastParagraph: string } = await req.json();

		if (!process.env.OPENAI_API_KEY) {
			return Response.json(
				{ error: "OpenAI API key not configured" },
				{ status: 500 }
			);
		}

		const result = await generateText({
			model: openai("gpt-4o-mini"), // Changed from gpt-5-mini to gpt-4o-mini
			system: `Return 1–2 ultra-short "prodding chips" that nudge deeper thinking.
    Format strictly as plain lines, no bullets, max 8 words each. 
    Tone: gentle, specific, non-judgmental.
    You have the world's knowledge and facts at your disposal, help the journaler see what they aren't in themselves.`,
			prompt: `Text:\n${lastParagraph}\n\nChips:`,
		});

		// Split the response into lines and return as JSON
		const prods = result.text
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0);

		return Response.json({ prods });
	} catch (error) {
		console.error('API Error:', error);
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}
