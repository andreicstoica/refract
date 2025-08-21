import type { Prod } from "@/types/prod";

/**
 * Select only the first prod for each sentence to avoid duplicates
 */
export function selectFirstProdPerSentence(prods: Prod[]): Prod[] {
	const seen = new Set<string>();
	return prods.filter(prod => {
		if (seen.has(prod.sentenceId)) return false;
		seen.add(prod.sentenceId);
		return true;
	});
}

