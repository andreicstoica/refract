import { describe, it, expect } from "bun:test";
import { queueReducer } from "@/features/prods/hooks/useProdQueueManager";
import type { QueueState, QueueItem } from "@/types/queue";
import type { Sentence } from "@/types/sentence";

const sentence: Sentence = {
	id: "s1",
	text: "Example sentence.",
	startIndex: 0,
	endIndex: 10,
};

function createItem(overrides: Partial<QueueItem> = {}): QueueItem {
	return {
		id: overrides.id ?? "q1",
		fullText: overrides.fullText ?? "Example sentence.",
		sentence: overrides.sentence ?? sentence,
		timestamp: overrides.timestamp ?? Date.now(),
		status: overrides.status ?? "pending",
		force: overrides.force,
	};
}

describe("queueReducer", () => {
	it("enqueues new items as pending", () => {
		const state: QueueState = { items: [], isProcessing: false };
		const payload = {
			id: "q1",
			fullText: "Example sentence.",
			sentence,
			timestamp: 1,
			force: false,
		} as const;
		const next = queueReducer(state, {
			type: "ENQUEUE",
			payload,
		});
		expect(next.items).toHaveLength(1);
		expect(next.items[0].status).toBe("pending");
	});

	it("marks items as processing and updates flag", () => {
		const state: QueueState = { items: [createItem()], isProcessing: false };
		const next = queueReducer(state, { type: "START_PROCESSING", payload: "q1" });
		expect(next.isProcessing).toBe(true);
		expect(next.items[0].status).toBe("processing");
	});

	it("removes items when processing completes or fails", () => {
		const state: QueueState = {
			items: [
				createItem({ id: "q1", status: "processing" }),
				createItem({ id: "q2", status: "pending" }),
			],
			isProcessing: true,
		};

		const afterComplete = queueReducer(state, { type: "COMPLETE_PROCESSING", payload: "q1" });
		expect(afterComplete.items.map((item) => item.id)).toEqual(["q2"]);
		expect(afterComplete.isProcessing).toBe(false);

		const afterFail = queueReducer(afterComplete, { type: "FAIL_PROCESSING", payload: "q2" });
		expect(afterFail.items).toHaveLength(0);
		expect(afterFail.isProcessing).toBe(false);
	});

	it("clears the queue state", () => {
		const state: QueueState = { items: [createItem()], isProcessing: true };
		const next = queueReducer(state, { type: "CLEAR_QUEUE" });
		expect(next).toEqual({ items: [], isProcessing: false });
	});
});
