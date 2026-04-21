type DashboardCompetitorLike = {
	name: string;
	appearances: number;
	visibility?: number;
	avgSentiment: number;
};

function getVisibility<T extends DashboardCompetitorLike>(row: T): number {
	return row.visibility ?? 0;
}

export function compareDashboardCompetitors<T extends DashboardCompetitorLike>(
	a: T,
	b: T,
): number {
	const visibilityDiff = getVisibility(b) - getVisibility(a);
	if (visibilityDiff !== 0) return visibilityDiff;
	if (a.appearances !== b.appearances) return b.appearances - a.appearances;
	if (a.avgSentiment !== b.avgSentiment) return b.avgSentiment - a.avgSentiment;
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
