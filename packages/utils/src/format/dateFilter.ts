export function isWithinRange(dateStr: string, days: number): boolean {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays <= days;
}
