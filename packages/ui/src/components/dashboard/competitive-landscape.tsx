"use client";

import { getFaviconUrls } from "@oneglanse/utils";
import { Users } from "lucide-react";
import { useMemo, type JSX } from "react";
import { Card } from "../card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table.js";
import { DashboardEmptyState } from "./empty-state.js";
import type { DashboardCompetitorData } from "./types.js";

function getVisibility(row: DashboardCompetitorData): number {
	return row.visibility ?? 0;
}

function compareRows(
	a: DashboardCompetitorData,
	b: DashboardCompetitorData,
): number {
	const visibilityDiff = getVisibility(b) - getVisibility(a);
	if (visibilityDiff !== 0) return visibilityDiff;
	if (a.appearances !== b.appearances) return b.appearances - a.appearances;
	if (a.avgSentiment !== b.avgSentiment) return b.avgSentiment - a.avgSentiment;
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sentimentTone(score: number): string {
	if (score >= 70) return "text-emerald-600 dark:text-emerald-300";
	if (score >= 40) return "text-amber-600 dark:text-amber-300";
	return "text-rose-600 dark:text-rose-300";
}

function displayCompetitors(
	competitors: DashboardCompetitorData[],
): DashboardCompetitorData[] {
	const sorted = [...competitors].sort(compareRows);
	const top = sorted.slice(0, 5);
	const hasBrand = top.some((row) => row.isBrand);

	if (hasBrand) return top;

	const brand = sorted.find((row) => row.isBrand);
	if (!brand || top.length === 0) return top;

	const next = [...top];
	next[next.length - 1] = brand;
	return next;
}

export function CompetitiveLandscape({
	competitors,
}: {
	competitors: DashboardCompetitorData[];
}): JSX.Element {
	const rows = useMemo(() => displayCompetitors(competitors), [competitors]);

	return (
		<Card className="flex h-full min-h-[460px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
			<div className="mb-5">
				<h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
					Competitors
				</h1>
				<p className="mt-1 text-xs text-muted-foreground">
					Visibility, mentions, and sentiment across analyzed responses.
				</p>
			</div>

			{rows.length === 0 ? (
				<DashboardEmptyState
					icon={Users}
					title="No competitor data"
					description="No analysis data is available for the selected filters."
				/>
			) : (
				<div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
					<Table className="w-full table-fixed">
						<TableHeader>
							<TableRow className="border-b border-gray-200 dark:border-gray-800">
								<TableHead className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Competitor
								</TableHead>
								<TableHead className="w-24 px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Visibility
								</TableHead>
								<TableHead className="w-24 px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Mentions
								</TableHead>
								<TableHead className="w-24 px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Sentiment
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const favicon = getFaviconUrls(row.domain ?? "")[0];
								const tone = sentimentTone(row.avgSentiment);
								const visibility = getVisibility(row);

								return (
									<TableRow
										key={row.name}
										className="border-b border-gray-100 last:border-0 dark:border-gray-800"
									>
										<TableCell className="px-4 py-4">
											<div className="flex items-center gap-2.5">
												{favicon ? (
													<img
														src={favicon}
														alt=""
														className="h-4 w-4 rounded-sm"
														onError={(e) => {
															(e.target as HTMLImageElement).style.display = "none";
														}}
													/>
												) : null}
												<span className="whitespace-normal break-words text-sm font-medium text-gray-900 dark:text-gray-100">
													{row.name}
												</span>
												{row.isBrand ? (
													<span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-neutral-800 dark:text-gray-200">
														You
													</span>
												) : null}
											</div>
										</TableCell>
										<TableCell className="px-4 py-4 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
											{visibility}%
										</TableCell>
										<TableCell className="px-4 py-4 text-right text-sm text-gray-700 dark:text-gray-200">
											{row.appearances}
										</TableCell>
										<TableCell className={`px-4 py-4 text-right text-sm font-semibold ${tone}`}>
											{row.avgSentiment}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</Card>
	);
}
