import { describe, it, expect } from "bun:test";
import { queueReducer } from "@/hooks/useProdsEnhanced";
import type { QueueState, QueueItem } from "@/types/queue";
import type { Sentence } from "@/types/sentence";

function makeSentence(id: string, text: string): Sentence {
	return { id, text, startIndex: 0, endIndex: text.length };
}

function makeBaseItem(id: string, text: string) {
	return {
		id,
		fullText: text,
		sentence: makeSentence(id, text),
		timestamp: Date.now(),
	};
}

describe("queueReducer", () => {
	it("enqueues a first pending item", () => {
		const initial: QueueState = { items: [], isProcessing: false };
		const item = makeBaseItem("q1", "Hello world.");
		const state1 = queueReducer(initial, { type: "ENQUEUE", payload: item });
		expect(state1.items.length).toBe(1);
		expect(state1.items[0].id).toBe("q1");
		expect(state1.items[0].status).toBe("pending");
	});

	it("keeps only the most recent pending item (prunes older pendings)", () => {
		const initial: QueueState = { items: [], isProcessing: false };
		const s1 = queueReducer(initial, { type: "ENQUEUE", payload: makeBaseItem("q1", "A.") });
		const s2 = queueReducer(s1, { type: "ENQUEUE", payload: makeBaseItem("q2", "B.") });
		expect(s2.items.length).toBe(1);
		expect(s2.items[0].id).toBe("q2");
		expect(s2.items[0].status).toBe("pending");
	});

	it("retains processing items when enqueuing a new pending", () => {
		const initial: QueueState = { items: [], isProcessing: false };
		const item1 = makeBaseItem("q1", "First.");
		let state = queueReducer(initial, { type: "ENQUEUE", payload: item1 });
		state = queueReducer(state, { type: "START_PROCESSING", payload: "q1" });
		expect(state.items[0].status).toBe("processing");

		const state2 = queueReducer(state, { type: "ENQUEUE", payload: makeBaseItem("q2", "Second.") });
		expect(state2.items.length).toBe(2);
		// First stays (processing), new pending is appended
		expect(state2.items.find((i) => i.id === "q1")?.status).toBe("processing");
		expect(state2.items.find((i) => i.id === "q2")?.status).toBe("pending");
	});

	it("transitions processing state and completes correctly", () => {
		const initial: QueueState = { items: [], isProcessing: false };
		const base = makeBaseItem("q1", "Do it.");
		let s = queueReducer(initial, { type: "ENQUEUE", payload: base });
		s = queueReducer(s, { type: "SET_PROCESSING", payload: true });
		expect(s.isProcessing).toBe(true);
		s = queueReducer(s, { type: "START_PROCESSING", payload: "q1" });
		expect(s.items[0].status).toBe("processing");
		s = queueReducer(s, { type: "COMPLETE_PROCESSING", payload: "q1" });
		expect(s.items.length).toBe(0);
		s = queueReducer(s, { type: "SET_PROCESSING", payload: false });
		expect(s.isProcessing).toBe(false);
	});

	it("fails processing by removing the item", () => {
		const initial: QueueState = { items: [], isProcessing: false };
		const base = makeBaseItem("q1", "Do it.");
		let s = queueReducer(initial, { type: "ENQUEUE", payload: base });
		s = queueReducer(s, { type: "FAIL_PROCESSING", payload: "q1" });
		expect(s.items.length).toBe(0);
	});

	it("clear_queue empties items and resets processing flag", () => {
		const initial: QueueState = { items: [], isProcessing: true };
		const base = makeBaseItem("q1", "Do it.");
		let s = queueReducer(initial, { type: "ENQUEUE", payload: base });
		s = queueReducer(s, { type: "START_PROCESSING", payload: "q1" });
		s = queueReducer(s, { type: "CLEAR_QUEUE" });
		expect(s.items.length).toBe(0);
		expect(s.isProcessing).toBe(false);
	});
});

