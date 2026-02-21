/**
 * Compute an exponential backoff delay.
 *
 * @param attempt - Zero-based attempt index (0 = first retry = base delay)
 * @param baseMs  - Delay for attempt 0, in milliseconds
 * @param capMs   - Maximum delay, in milliseconds
 *
 * @example
 * exponentialBackoff(0, 1000, 5000) // 1000
 * exponentialBackoff(1, 1000, 5000) // 2000
 * exponentialBackoff(2, 1000, 5000) // 4000
 * exponentialBackoff(3, 1000, 5000) // 5000 (capped)
 */
export function exponentialBackoff(
	attempt: number,
	baseMs: number,
	capMs: number,
): number {
	return Math.min(baseMs * 2 ** attempt, capMs);
}
