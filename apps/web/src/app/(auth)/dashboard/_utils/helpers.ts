export function severityRank(s: string): number {
	return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}

export function priorityRank(p: string): number {
	return p === "critical" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1;
}

export function getSentimentColor(score: number) {
	if (score >= 60)
		return {
			text: "text-emerald-600 dark:text-emerald-400",
			bg: "bg-emerald-500",
		};
	if (score >= 40)
		return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" };
	return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500" };
}

export function getGeoScoreColor(score: number) {
	if (score >= 60) return "#22c55e";
	if (score >= 30) return "#f59e0b";
	return "#ef4444";
}
