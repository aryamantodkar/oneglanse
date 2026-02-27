import {
	Card,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@oneglanse/ui";
import { getFaviconUrls } from "@oneglanse/utils";
import { CircleHelp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { CompetitorData } from "../_utils/types";
import { DashboardEmptyState } from "./empty-state";

function compareByName(a: CompetitorData, b: CompetitorData): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function recommendationRatio(c: CompetitorData): number {
	if (c.appearances <= 0) return 0;
	return c.recCount / c.appearances;
}

function compareByRankDeterministic(
	a: CompetitorData,
	b: CompetitorData,
): number {
	if (a.avgRank === null && b.avgRank !== null) return 1;
	if (a.avgRank !== null && b.avgRank === null) return -1;
	if (a.avgRank !== null && b.avgRank !== null && a.avgRank !== b.avgRank) {
		return a.avgRank - b.avgRank;
	}

	// Tie-break #1: stronger recommendation consistency wins
	const recRatioDiff = recommendationRatio(b) - recommendationRatio(a);
	if (recRatioDiff !== 0) return recRatioDiff;

	// Tie-break #2: more total recommendations wins
	if (a.recCount !== b.recCount) return b.recCount - a.recCount;

	// Tie-break #3: broader appearance coverage wins
	if (a.appearances !== b.appearances) return b.appearances - a.appearances;

	// Tie-break #4: higher sentiment wins
	if (a.avgSentiment !== b.avgSentiment) return b.avgSentiment - a.avgSentiment;

	// Tie-break #5: more wins and fewer losses win
	if (a.winsOver.length !== b.winsOver.length) {
		return b.winsOver.length - a.winsOver.length;
	}
	if (a.losesTo.length !== b.losesTo.length) {
		return a.losesTo.length - b.losesTo.length;
	}

	// Final deterministic fallback
	return compareByName(a, b);
}

function SentimentBadge({ value }: { value: number }) {
	let bgClass = "";
	let dotClass = "";

	if (value >= 70) {
		bgClass =
			"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
		dotClass = "bg-emerald-500";
	} else if (value >= 40) {
		bgClass =
			"bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
		dotClass = "bg-amber-500";
	} else {
		bgClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
		dotClass = "bg-rose-500";
	}

	return (
		<div
			className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${bgClass}`}
		>
			<span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
			{value}
		</div>
	);
}

export function CompetitiveLandscape({
	competitors,
	modelFilter,
}: {
	competitors: CompetitorData[];
	modelFilter: string;
}): React.JSX.Element {
	const [competitorSort, setCompetitorSort] = useState<
		"appearances" | "sentiment" | "rank"
	>("rank");

	const sortedCompetitors = useMemo(() => {
		const sorted = [...competitors];
		switch (competitorSort) {
			case "appearances":
				sorted.sort((a, b) => {
					if (a.appearances !== b.appearances)
						return b.appearances - a.appearances;
					if (a.recCount !== b.recCount) return b.recCount - a.recCount;
					if (a.avgSentiment !== b.avgSentiment)
						return b.avgSentiment - a.avgSentiment;
					return compareByName(a, b);
				});
				break;
			case "sentiment":
				sorted.sort((a, b) => {
					if (a.avgSentiment !== b.avgSentiment)
						return b.avgSentiment - a.avgSentiment;
					if (a.appearances !== b.appearances)
						return b.appearances - a.appearances;
					return compareByName(a, b);
				});
				break;
			case "rank":
				sorted.sort(compareByRankDeterministic);
				break;
		}
		return sorted;
	}, [competitors, competitorSort]);

	const displayCompetitors = useMemo(() => {
		const sorted = sortedCompetitors;
		// Take top 5, but ensure brand is always visible
		const top5 = sorted.slice(0, 5);
		const brandInTop5 = top5.some((c) => c.isBrand);
		if (!brandInTop5) {
			const brandEntry = sorted.find((c) => c.isBrand);
			if (brandEntry) {
				top5[4] = brandEntry;
			}
		}

		return top5;
	}, [sortedCompetitors]);

	const uniqueRankMap = useMemo(() => {
		const map = new Map<string, number>();
		if (competitorSort !== "rank") return map;

		let currentRank = 1;
		// Rank across full competitor set so rank card and competitor list stay consistent.
		for (const competitor of sortedCompetitors) {
			if (competitor.avgRank === null) continue;
			map.set(competitor.name, currentRank);
			currentRank += 1;
		}

		return map;
	}, [sortedCompetitors, competitorSort]);

	return (
		<Card className="flex h-full min-h-[500px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="mt-2 flex items-center gap-2">
						<h1 className="text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
							Competitors
						</h1>
						{competitorSort === "rank" && (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="inline-flex cursor-help items-center justify-center rounded-full border border-gray-200 bg-white p-1 text-muted-foreground transition-colors hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:hover:text-gray-100"
										aria-label="Ranking logic"
									>
										<CircleHelp className="h-3.5 w-3.5" />
									</button>
								</TooltipTrigger>
								<TooltipContent
									side="top"
									sideOffset={8}
									className="max-w-[260px] leading-relaxed"
								>
									Rank order prioritizes average position, with tie-breaking
									based on recommendation consistency, recommendation count,
									mention volume, and sentiment strength.
								</TooltipContent>
							</Tooltip>
						)}
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						See how you stack up against competitors.
					</p>
				</div>

				{/* Sort Filter */}
				<Select
					value={competitorSort}
					onValueChange={(v) => setCompetitorSort(v as any)}
				>
					<SelectTrigger className="h-9 w-32 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="rank">Rank</SelectItem>
						<SelectItem value="sentiment">Sentiment</SelectItem>
						<SelectItem value="appearances">Mentions</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Competitor List */}
			{competitors.length === 0 ? (
				<DashboardEmptyState
					icon={Users}
					title="No competitor data"
					description="No analysis data is available for the selected filters."
				/>
			) : (
				<div className="flex flex-1 flex-col justify-around">
					{displayCompetitors.map((comp) => {
						const faviconUrls = getFaviconUrls(comp?.domain ?? "");
						const isBrand = comp.isBrand === true;

						return (
							<div
								key={comp.name}
								className={`ui-list-item group flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
									isBrand
										? "border-l-2 border-l-blue-500 border-y-gray-200 border-r-gray-200 bg-blue-50/60 dark:border-y-gray-800 dark:border-r-gray-800 dark:bg-blue-950/30"
										: "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
								}`}
							>
								{/* LEFT — Icon + Name + Secondary metrics */}
								<div className="min-w-0 flex-1 flex flex-col">
									{/* Row 1 → Icon + Name + You pill */}
									<div className="flex items-center gap-2 min-w-0">
										{faviconUrls[0] && (
											<img
												src={faviconUrls[0]}
												alt=""
												className="h-5 w-5 shrink-0 rounded-md object-contain transition-transform duration-200 group-hover:scale-105"
												onError={(e) =>
													((e.target as HTMLImageElement).style.display =
														"none")
												}
											/>
										)}

										<p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
											{comp.name}
										</p>

										{isBrand && (
											<span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
												You
											</span>
										)}
									</div>
								</div>

								{/* RIGHT — Primary metric (the one being sorted by) */}
								<div className="shrink-0">
									{competitorSort === "rank" && comp.avgRank !== null && (
										<div className="flex items-center gap-1 text-sm">
											<span className="font-semibold text-gray-900 dark:text-gray-100">
												#{uniqueRankMap.get(comp.name)}
											</span>
											<span className="text-[10px] font-medium text-muted-foreground">
												avg pos #{comp.avgRank}
											</span>
										</div>
									)}
									{competitorSort === "sentiment" && (
										<SentimentBadge value={comp.avgSentiment} />
									)}
									{competitorSort === "appearances" && (
										<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
											{comp.appearances}
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
