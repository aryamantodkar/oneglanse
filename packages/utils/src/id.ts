export function newId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID()}`;
}
