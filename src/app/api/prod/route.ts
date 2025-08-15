// app/api/prods/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 15;

export async function POST(req: Request) {
	const { lastParagraph }: { lastParagraph: string } = await req.json();

	const result = streamText({
		model: openai("gpt-5-mini"),
		system: `Return 1–2 ultra-short "prodding chips" that nudge deeper thinking.
    Format strictly as plain lines, no bullets, max 8 words each. 
    Tone: gentle, specific, non-judgmental.
    You have the world's knowledge and facts at your disposal, help the journaler see what they aren't in themselves.`,
		prompt: `Text:\n${lastParagraph}\n\nChips:`,
	});

	return result.toTextStreamResponse(); // plain text lines, streamed
}
