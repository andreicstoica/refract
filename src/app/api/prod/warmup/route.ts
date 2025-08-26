import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const runtime = "edge";
export const maxDuration = 10;

// A tiny warmup endpoint to reduce demo cold starts.
// It compiles/loads the route and optionally performs a very small model call
// to warm provider latency. It returns quickly and ignores errors.
export async function GET() {
	try {
		// Optional: do a minimal model roundtrip to warm provider (tiny tokens)
		// Safe-guarded by a very small schema to keep it cheap.
		const WarmupSchema = z.object({ ok: z.boolean() });
		await generateObject({
			model: openai("gpt-5-mini"),
			system: "You are a health check. Return { ok: true }.",
			prompt: "Return ok true.",
			schema: WarmupSchema,
		});
	} catch {
		// Intentionally ignore provider/network errors; the goal is just to warm the route.
	}

	return new NextResponse(null, { status: 204 });
}

