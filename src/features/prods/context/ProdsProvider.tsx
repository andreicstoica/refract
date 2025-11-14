"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Sentence } from "@/types/sentence";
import type { Prod } from "@/types/prod";
import type { QueueState } from "@/types/queue";
import { useTimingConfig } from "@/features/config/TimingConfigProvider";
import { useProdQueueManager } from "../hooks/useProdQueueManager";

interface ProdStateContextValue {
	prods: Prod[];
	queue: QueueState;
	pinnedIds: Set<string>;
	filteredSentences: Sentence[];
}

interface ProdActionsContextValue {
	enqueueSentence(args: { fullText: string; sentence: Sentence; force?: boolean }): void;
	injectProd(args: { fullText: string; sentence: Sentence; text: string }): void;
	pin(id: string): void;
	remove(id: string): void;
	notifyTopicShift(): void;
	clearAll(): void;
	clearFilteredSentences(): void;
	updateTopicContext(args: { keywords?: string[]; version?: number }): void;
}

const ProdStateContext = createContext<ProdStateContextValue | null>(null);
const ProdActionsContext = createContext<ProdActionsContextValue | null>(null);

function keywordsEqual(a: string[], b: string[]): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export function ProdsProvider({ children }: { children: React.ReactNode }) {
	const { config, isDemoMode } = useTimingConfig();
	const [topicKeywords, setTopicKeywords] = useState<string[]>([]);
	const [topicVersion, setTopicVersion] = useState<number | undefined>(undefined);

	const manager = useProdQueueManager({
		config,
		isDemoMode,
		topicKeywords,
		topicVersion,
	});
	const {
		prods,
		queueState,
		pinnedIds,
		filteredSentences,
		enqueueSentence,
		injectProd,
		pinProd,
		removeProd,
		handleTopicShift,
		clearAll,
		clearFilteredSentences,
	} = manager;

	const updateTopicContext = useCallback(({ keywords, version }: { keywords?: string[]; version?: number }) => {
		if (keywords && !keywordsEqual(keywords, topicKeywords)) {
			setTopicKeywords(keywords);
		}
		if (typeof version === "number" && version !== topicVersion) {
			setTopicVersion(version);
		}
	}, [topicKeywords, topicVersion]);

	const stateValue = useMemo<ProdStateContextValue>(() => ({
		prods,
		queue: queueState,
		pinnedIds,
		filteredSentences,
	}), [prods, queueState, pinnedIds, filteredSentences]);

	const actionsValue = useMemo<ProdActionsContextValue>(() => ({
		enqueueSentence: ({ fullText, sentence, force }) => enqueueSentence(fullText, sentence, { force }),
		injectProd: ({ fullText, sentence, text }) => injectProd(fullText, sentence, text),
		pin: pinProd,
		remove: removeProd,
		notifyTopicShift: handleTopicShift,
		clearAll,
		clearFilteredSentences,
		updateTopicContext,
	}), [
		enqueueSentence,
		injectProd,
		pinProd,
		removeProd,
		handleTopicShift,
		clearAll,
		clearFilteredSentences,
		updateTopicContext,
	]);

	return (
		<ProdStateContext.Provider value={stateValue}>
			<ProdActionsContext.Provider value={actionsValue}>
				{children}
			</ProdActionsContext.Provider>
		</ProdStateContext.Provider>
	);
}

export function useProdState() {
	const ctx = useContext(ProdStateContext);
	if (!ctx) {
		throw new Error("useProdState must be used within a ProdsProvider");
	}
	return ctx;
}

export function useProdActions() {
	const ctx = useContext(ProdActionsContext);
	if (!ctx) {
		throw new Error("useProdActions must be used within a ProdsProvider");
	}
	return ctx;
}
