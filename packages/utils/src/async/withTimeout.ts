export async function withTimeout<T>(
	label: string,
	fn: () => Promise<T>,
	timeoutMs: number,
): Promise<T> {
	let timeoutId: NodeJS.Timeout | undefined;

	try {
		return await Promise.race([
			fn(),
			new Promise<T>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error(`${label} timed out after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}
