import { describe, it, expect } from "bun:test";
import { generateProd, generateProdWithTimeout } from "@/services/prodClient";

// Helper to create an AbortController that aborts after ms
function autoAbort(ms: number) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

describe("prodClient", () => {
  it("returns data on success", async () => {
    const mockBody = { selectedProd: "What felt most meaningful?", confidence: 0.9 };

    // @ts-expect-error override global fetch
    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockBody), { status: 200, headers: { "Content-Type": "application/json" } }));

    const res = await generateProd({ lastParagraph: "I had a good day.", fullText: "I had a good day." });
    expect(res.selectedProd).toBe(mockBody.selectedProd);
    expect(res.confidence).toBe(0.9);
  });

  it("soft-skips on abort/timeout", async () => {
    // Mock fetch that never resolves but rejects on abort
    // @ts-expect-error override global fetch
    globalThis.fetch = (_input: any, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          const onAbort = () => {
            const err = new Error("Aborted");
            (err as any).name = "AbortError";
            reject(err);
          };
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    };

    const external = autoAbort(5); // abort quickly
    const res = await generateProdWithTimeout({ lastParagraph: "...", fullText: "..." }, { signal: external.signal });
    expect(res.confidence).toBe(0);
  });
});
