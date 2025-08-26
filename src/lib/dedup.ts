// Lightweight helpers for de-duplication and TTL maps used by prods

export function normalizeText(text: string): string {
	return text.trim().toLowerCase();
}

export function makeFingerprint(text: string): string {
	const t = String(text);
	return `${t.substring(0, 30).toLowerCase()}-${t.length}`;
}

export function hasRecent(
	map: Map<string, number>,
	key: string,
	maxAgeMs: number,
	now: number = Date.now()
): boolean {
	const ts = map.get(key);
	return typeof ts === 'number' && (now - ts) < maxAgeMs;
}

export function markNow(
	map: Map<string, number>,
	key: string,
	now: number = Date.now()
): void {
	map.set(key, now);
}

export function cleanupOlderThan(
	map: Map<string, number>,
	maxAgeMs: number,
	now: number = Date.now()
): void {
	for (const [k, ts] of map.entries()) {
		if ((now - ts) > maxAgeMs) {
			map.delete(k);
		}
	}
}

