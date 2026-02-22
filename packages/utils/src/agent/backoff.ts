export function exponentialBackoff(
	attempt: number,
	baseMs: number,
	capMs: number,
): number {
	return Math.min(baseMs * 2 ** attempt, capMs);
}
