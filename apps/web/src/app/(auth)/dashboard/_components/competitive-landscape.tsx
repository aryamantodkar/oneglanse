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

	const maxMentions = useMemo(
		() => Math.max(...competitors.map((c) => c.appearances), 1),
		[competitors],
	);

	const sentimentColor = getSentimentColor(brandSentiment);

	const tabClass = (value: 'rank' | 'sentiment' | 'appearances') =>
		`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
			competitorSort === value
				? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
				: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
		}`;

	if (competitors.length === 0) return null;

	return (
		<Card className="relative overflow-hidden border-none bg-white/80 shadow-sm ring-1 ring-slate-100 backdrop-blur-sm dark:bg-slate-900/70 dark:ring-slate-800">
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
			<div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
			<CardHeader className="relative pb-4 px-5 pt-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
							Competitive Pulse
						</p>
						<CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
							Competitors
						</CardTitle>
					</div>
					<div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white ${sentimentColor.bg}`}>
						<span className="uppercase tracking-[0.08em] text-[10px] opacity-80">{brandName}</span>
						<span className="leading-none">{brandSentiment}</span>
					</div>
				</div>
				<div className="mt-3 flex gap-2 rounded-full bg-white/70 p-1 text-xs ring-1 ring-slate-200 backdrop-blur-sm dark:bg-slate-900/60 dark:ring-slate-800">
					<button onClick={() => setCompetitorSort('rank')} className={tabClass('rank')}>
						Rank
					</button>
					<button onClick={() => setCompetitorSort('sentiment')} className={tabClass('sentiment')}>
						Sentiment
					</button>
					<button onClick={() => setCompetitorSort('appearances')} className={tabClass('appearances')}>
						Mentions
					</button>
				</div>
			</CardHeader>
			<CardContent className="relative px-5 pb-5 pt-0">
				<div className="space-y-3">
					{sortedCompetitors.slice(0, 5).map((comp, idx) => {
						const mentionWidth = Math.max(
							12,
							Math.round((comp.appearances / maxMentions) * 100),
						);

						return (
							<div
								key={comp.name}
								className="flex items-center gap-3 rounded-xl border border-slate-100/70 bg-white/80 px-3 py-3 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60"
							>
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
									{idx + 1}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
											{comp.name}
										</p>
										{comp.avgRank !== null && (
											<span className="text-[11px] text-slate-500 dark:text-slate-400">
												#{comp.avgRank} rank
											</span>
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
										<span className={`${getSentimentColor(comp.avgSentiment).text} font-semibold`}>
											{comp.avgSentiment} sentiment
										</span>
										<span className="flex items-center gap-1">
											<span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
											{comp.appearances} mentions
										</span>
									</div>
									<div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
										<div
											className="h-full rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-white/80 dark:to-white/60"
											style={{ width: `${mentionWidth}%` }}
										/>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
