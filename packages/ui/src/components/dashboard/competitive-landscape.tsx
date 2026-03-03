"use client";

import { getFaviconUrls } from "@oneglanse/utils";
import { Users } from "lucide-react";
import { useMemo, type JSX } from "react";
import { Card } from "../card.js";
import { SentimentMetricCell } from "../cell.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table.js";
import { useSortState, type SortDirection } from "../../hooks/use-sort-state.js";
import { DashboardEmptyState } from "./empty-state.js";
import { SortableHeader } from "./sortable-header.js";
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

type SortColumn = "visibility" | "mentions" | "sentiment";

function compareByColumn(
	a: DashboardCompetitorData,
	b: DashboardCompetitorData,
	column: SortColumn,
	direction: SortDirection,
): number {
	const factor = direction === "asc" ? 1 : -1;
	let diff = 0;

	if (column === "visibility") {
		diff = getVisibility(a) - getVisibility(b);
	}

	if (column === "mentions") {
		diff = a.appearances - b.appearances;
	}

	if (column === "sentiment") {
		diff = a.avgSentiment - b.avgSentiment;
	}

	if (diff !== 0) return diff * factor;

	return compareRows(a, b);
}

function displayCompetitors(
	competitors: DashboardCompetitorData[],
	sortColumn: SortColumn,
	sortDirection: SortDirection,
): DashboardCompetitorData[] {
	const MAX_VISIBLE_ROWS = 8;
	const sorted = [...competitors].sort((a, b) =>
		compareByColumn(a, b, sortColumn, sortDirection),
	);
	const visible = sorted.slice(0, MAX_VISIBLE_ROWS);
	const hasBrand = visible.some((row) => row.isBrand);

	if (hasBrand) return visible;

	const brand = sorted.find((row) => row.isBrand);
	if (!brand || visible.length === 0) return visible;

	const next = [...visible];
	next[next.length - 1] = brand;
	return next;
}

export function CompetitiveLandscape({
	competitors,
}: {
	competitors: DashboardCompetitorData[];
}): JSX.Element {
	const { sortColumn, sortDirection, toggleSort } = useSortState<SortColumn>(
		"visibility",
		"desc",
	);

	const rows = useMemo(
		() => displayCompetitors(competitors, sortColumn, sortDirection),
		[competitors, sortColumn, sortDirection],
	);

	return (
		<Card className="flex h-full min-h-[460px] flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black">
			<div className="mb-4">
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
								<TableHead className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Competitor
								</TableHead>
								<TableHead className="w-24 px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									<SortableHeader
										column="visibility"
										currentSort={sortColumn}
										currentDirection={sortDirection}
										onSort={toggleSort}
										className="ml-auto"
									>
										Visibility
									</SortableHeader>
								</TableHead>
								<TableHead className="w-24 px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									<SortableHeader
										column="mentions"
										currentSort={sortColumn}
										currentDirection={sortDirection}
										onSort={toggleSort}
										className="ml-auto"
									>
										Mentions
									</SortableHeader>
								</TableHead>
								<TableHead className="w-24 px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									<SortableHeader
										column="sentiment"
										currentSort={sortColumn}
										currentDirection={sortDirection}
										onSort={toggleSort}
										className="ml-auto"
									>
										Sentiment
									</SortableHeader>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const favicon = getFaviconUrls(row.domain ?? "")[0];
								const visibility = getVisibility(row);

								return (
									<TableRow
										key={row.name}
										className="border-b border-gray-100 last:border-0 dark:border-gray-800"
									>
										<TableCell className="px-3 py-3.5">
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
										<TableCell className="px-3 py-3.5 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
											{visibility}%
										</TableCell>
										<TableCell className="px-3 py-3.5 text-right text-sm text-gray-700 dark:text-gray-200">
											{row.appearances}
										</TableCell>
										<TableCell className="px-3 py-3.5 text-right">
											<span className="inline-flex justify-end">
												<SentimentMetricCell sentiment={row.avgSentiment} />
											</span>
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
