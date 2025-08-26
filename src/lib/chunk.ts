export type ClosedChunk = { text: string; start: number; end: number };

// Split a sentence into closed chunks based on lightweight boundaries.
// Returns only closed chunks; the trailing open fragment (if any) is omitted.
export function splitIntoClosedChunks(input: string, opts?: { minWindow?: number; maxWindow?: number }): ClosedChunk[] {
	const text = String(input);
	const minWindow = opts?.minWindow ?? 80;
	const maxWindow = opts?.maxWindow ?? 120;

	const boundaries: number[] = [];

	// Punctuation and clause boundaries: commas, semicolons, colons, em/en dashes, spaced hyphen
	const punctuationRe = /(,|;|:|—|–|\s-\s)/g;
	let m: RegExpExecArray | null;
	while ((m = punctuationRe.exec(text)) !== null) {
		const idx = m.index + m[0].length; // boundary after the match
		boundaries.push(idx);
	}

	// Length-based boundaries: ensure chunks aren't too long
	const result: ClosedChunk[] = [];
	let start = 0;
	const sorted = boundaries.sort((a, b) => a - b);

	function pushBoundary(end: number) {
		const chunkText = text.slice(start, end);
		if (chunkText.trim().length > 0) {
			result.push({ text: chunkText, start, end });
		}
		start = end;
	}

	let i = 0;
	while (i < sorted.length) {
		const nextBoundary = sorted[i];
		const span = nextBoundary - start;
		if (span >= minWindow) {
			// Accept the punctuation boundary
			pushBoundary(nextBoundary);
			i++;
			continue;
		}
		// If too short, try to coalesce with following boundaries within maxWindow
		let j = i + 1;
		let mergedEnd = nextBoundary;
		while (j < sorted.length && (sorted[j] - start) <= maxWindow) {
			mergedEnd = sorted[j];
			j++;
		}
		if (mergedEnd - start >= minWindow) {
			pushBoundary(mergedEnd);
			i = j;
			continue;
		}
		// Not enough length yet; move to next and try again
		i++;
	}

	// If we've exceeded maxWindow without punctuation, hard-wrap at nearest space
	while (text.length - start > maxWindow) {
		const windowEnd = start + maxWindow;
		const slice = text.slice(start, windowEnd);
		const lastSpace = slice.lastIndexOf(" ");
		const cut = lastSpace > start + minWindow ? start + lastSpace : windowEnd;
		pushBoundary(cut);
	}

	// Do not include trailing open fragment
	return result;
}

