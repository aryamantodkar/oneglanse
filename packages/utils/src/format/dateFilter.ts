import { parseDateString } from "./formatDate.js";

export function isWithinRange(dateStr: string, days: number): boolean {
	const date = parseDateString(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays <= days;
}
