export function newId(prefix: string) {
	return `${prefix}_${crypto.randomUUID()}`;
}
