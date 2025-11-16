import { describe, it, expect } from "bun:test";
import { mock } from "bun:test";
import { subscribe } from "@/features/ui/hooks/useRafScroll";

describe("subscribe", () => {
	it("invokes handlers immediately even without window APIs", () => {
		const handler = mock(() => {});
		const element = { scrollTop: 0, scrollLeft: 0 } as unknown as HTMLElement;

		const unsubscribe = subscribe(element, handler);
		expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1);
		unsubscribe();

		// Subscribing again should work after cleanup.
		const again = subscribe(element, handler);
		expect(handler.mock.calls.length).toBeGreaterThanOrEqual(2);
		again();
	});
});

