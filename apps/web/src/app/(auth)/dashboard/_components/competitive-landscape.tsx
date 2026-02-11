import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { getSentimentColor } from "../_utils/helpers";
import type { CompetitorData } from "../_utils/types";

export function CompetitiveLandscape({
	competitors,
	brandName,
	brandSentiment,
}: {
	competitors: CompetitorData[];
	brandName: string;
	brandSentiment: number;
}) {
	const [competitorSort, setCompetitorSort] = useState<'appearances' | 'sentiment' | 'rank'>('rank');

	// Sort competitors based on selected criteria
	const sortedCompetitors = useMemo(() => {
		const sorted = [...competitors];
		switch(competitorSort) {
			case 'appearances':
				return sorted.sort((a, b) => b.appearances - a.appearances);
			case 'sentiment':
				return sorted.sort((a, b) => b.avgSentiment - a.avgSentiment);
			case 'rank':
				return sorted.sort((a, b) => {
					if (a.avgRank === null) return 1;
					if (b.avgRank === null) return -1;
					// Primary sort by rank, secondary by appearances for tie-breaking
					if (a.avgRank === b.avgRank) {
						return b.appearances - a.appearances;
					}
					return a.avgRank - b.avgRank;
				});
			default:
				return sorted;
		}
	}, [competitors, competitorSort]);

	if (competitors.length === 0) return null;

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-semibold">Competitors</CardTitle>
					<div className="flex gap-1">
						<button
							onClick={() => setCompetitorSort('rank')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'rank'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Rank
						</button>
						<button
							onClick={() => setCompetitorSort('sentiment')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'sentiment'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Sentiment
						</button>
						<button
							onClick={() => setCompetitorSort('appearances')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'appearances'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Frequency
						</button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-2">
					{sortedCompetitors.slice(0, 5).map((comp, idx) => (
						<div
							key={comp.name}
							className="flex items-center justify-between py-2.5"
						>
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<span className="text-gray-400 text-xs font-medium w-6 shrink-0">
									{idx + 1}
								</span>
								<span className="font-medium text-sm truncate">
									{comp.name}
								</span>
							</div>
							<div className="flex items-center gap-4 shrink-0">
								{comp.avgRank !== null && (
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											#{comp.avgRank}
										</div>
										<div className="text-[10px] text-gray-400">
											rank
										</div>
									</div>
								)}
								<div className="text-center min-w-[48px]">
									<div className={`text-sm font-semibold ${getSentimentColor(comp.avgSentiment).text}`}>
										{comp.avgSentiment}
									</div>
									<div className="text-[10px] text-gray-400">
										sentiment
									</div>
								</div>
								<div className="text-center min-w-[48px]">
									<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
										{comp.appearances}
									</div>
									<div className="text-[10px] text-gray-400">
										mentions
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
