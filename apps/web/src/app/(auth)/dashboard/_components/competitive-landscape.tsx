import { useMemo, useState } from "react";
import { Card } from "@onescope/ui";
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
	const [competitorSort, setCompetitorSort] =
	  useState<'appearances' | 'sentiment' | 'rank'>('rank');
  
	const sortedCompetitors = useMemo(() => {
	  const sorted = [...competitors];
	  switch (competitorSort) {
		case 'appearances':
		  return sorted.sort((a, b) => b.appearances - a.appearances);
		case 'sentiment':
		  return sorted.sort((a, b) => b.avgSentiment - a.avgSentiment);
		case 'rank':
		  return sorted.sort((a, b) => {
			if (a.avgRank === null) return 1;
			if (b.avgRank === null) return -1;
			if (a.avgRank === b.avgRank) {
			  return b.appearances - a.appearances;
			}
			return a.avgRank - b.avgRank;
		  });
		default:
		  return sorted;
	  }
	}, [competitors, competitorSort]);
  
	const maxMentions = useMemo(() => {
		const max = Math.max(...competitors.map(c => c.appearances));
		return max;
	}, [competitors]);
  
	if (competitors.length === 0) return null;
  
	const tabClass = (value: 'rank' | 'sentiment' | 'appearances') =>
	  `rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
		competitorSort === value
		  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
		  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
	  }`;
  
	return (
	  <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
		
		{/* Header */}
		<div className="flex items-center justify-between">
		  <div>
			<p className="text-xs text-muted-foreground">
			  Competitive Landscape
			</p>
			<h3 className="text-sm font-semibold">
			  Competitors
			</h3>
		  </div>
  
		  <div className="text-xs text-muted-foreground">
			{brandName}: <span className="font-semibold">{brandSentiment}</span>
		  </div>
		</div>
  
		{/* Sort Tabs */}
		<div className="mt-3 flex items-center gap-3 text-xs">
			{["rank", "sentiment", "appearances"].map((type) => (
				<button
				key={type}
				onClick={() => setCompetitorSort(type as any)}
				className={`transition-colors ${
					competitorSort === type
					? "text-foreground font-medium"
					: "text-muted-foreground hover:text-foreground"
				}`}
				>
				{type === "appearances" ? "Mentions" : 
				type.charAt(0).toUpperCase() + type.slice(1)}
				</button>
			))}
		</div>
  
		{/* Competitor List */}
		<div className="mt-4 space-y-3">
		  {sortedCompetitors.slice(0, 5).map((comp, idx) => {
			const mentionWidth =
				maxMentions === 0
				? 0
				: Math.max(
					8,
					Math.round((comp.appearances / maxMentions) * 100)
					);
  
			return (
			  <div
				key={comp.name}
				className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-3 dark:border-gray-800"
			  >
				{/* Light, Minimal Rank Number */}
				<div className="text-xs text-muted-foreground w-4 text-center">
				  {idx + 1}
				</div>
  
				{/* Content */}
				<div className="min-w-0 flex-1">
				  <div className="flex items-center justify-between gap-2">
					<p className="truncate text-sm font-medium">
					  {comp.name}
					</p>
					{comp.avgRank !== null && (
					  <span className="text-xs text-muted-foreground">
						#{comp.avgRank}
					  </span>
					)}
				  </div>
  
				  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
					<span>
					  {comp.avgSentiment} sentiment
					</span>
					<span>
					  {comp.appearances} mentions
					</span>
				  </div>
  
				  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
					<div
					  className="h-full rounded-full bg-slate-900 dark:bg-white"
					  style={{ width: `${mentionWidth}%` }}
					/>
				  </div>
				</div>
			  </div>
			);
		  })}
		</div>
	  </Card>
	);
  }