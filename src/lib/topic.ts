import nlp from 'compromise';

export interface TopicState {
	keywords: string[];
	emaOverlap: number;
	lowCount: number;
	lastUpdate: number;
}

export const DEFAULTS = {
	threshold: 0.3,         // Single overlap threshold
	minConsecutive: 2,      // Grace period before shift
	alpha: 0.5,             // Smoothing factor
	keywordLimit: 15,       // Cap keywords for performance
};

export function extractKeywords(text: string): string[] {
  if (!text.trim()) return [];

  // Limit analysis to most recent context window for performance
  const WINDOW = 600; // characters
  const slice = text.length > WINDOW ? text.slice(-WINDOW) : text;

  const doc = nlp(slice);
  const keywords = new Set<string>();

  // Extract nouns and noun phrases
  const nouns = doc.nouns().out('array');

  // Add lemmatized versions
  nouns.forEach((word: string) => {
    const lemma = nlp(word).nouns().toSingular().out('text');
    if (lemma) keywords.add(lemma.toLowerCase());
  });

  // Also add verbs and adjectives as secondary keywords
  const verbs = doc.verbs().out('array');
  const adjectives = doc.adjectives().out('array');

  [...verbs, ...adjectives].slice(0, 5).forEach((word: string) => {
    const lemma = nlp(word).verbs().toInfinitive().out('text') ||
                  nlp(word).adjectives().toSuperlative().out('text') ||
                  word;
    if (lemma) keywords.add(lemma.toLowerCase());
  });

  // Limit to prevent performance issues
  return Array.from(keywords).slice(0, DEFAULTS.keywordLimit);
}

export function jaccardOverlap(setA: string[], setB: string[]): number {
	const A = new Set(setA);
	const B = new Set(setB);

	if (A.size === 0 && B.size === 0) return 1;
	if (A.size === 0 || B.size === 0) return 0;

	let intersection = 0;
	for (const item of A) {
		if (B.has(item)) intersection++;
	}

	const union = A.size + B.size - intersection;
	return intersection / union;
}

export function updateTopicState(
	currentKeywords: string[],
	state: TopicState,
	now = Date.now(),
	cfg = DEFAULTS
): { shift: boolean; state: TopicState } {
	const overlap = jaccardOverlap(currentKeywords, state.keywords);
	const emaOverlap = (1 - cfg.alpha) * state.emaOverlap + cfg.alpha * overlap;

	let lowCount = emaOverlap < cfg.threshold ? state.lowCount + 1 : 0;
	const shift = lowCount >= cfg.minConsecutive;

	// If not shifting and keyword sets are identical, reuse previous array ref to avoid churn
	const sameKeywordSet = (() => {
		if (state.keywords.length === currentKeywords.length) {
			const A = new Set(state.keywords);
			for (const k of currentKeywords) if (!A.has(k)) return false;
			return true;
		}
		return false;
	})();

	const nextState: TopicState = shift
		? {
			keywords: currentKeywords,
			emaOverlap: 0.5, // Reset for new topic
			lowCount: 0,
			lastUpdate: now
		}
		: {
			keywords: sameKeywordSet ? state.keywords : currentKeywords,
			emaOverlap,
			lowCount,
			lastUpdate: now
		};

	// Avoid unnecessary re-renders: if nothing changed materially, return previous state ref
	if (!shift && sameKeywordSet && nextState.emaOverlap === state.emaOverlap && nextState.lowCount === state.lowCount) {
		return { shift: false, state };
	}

	return { shift, state: nextState };
}

