/**
 * Safely extracts a string message from an unknown caught value.
 * JS allows throwing anything (strings, numbers, plain objects), so
 * `err instanceof Error` is not guaranteed inside catch blocks.
 */
export function toErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === "string") return err;
	return String(err);
}
