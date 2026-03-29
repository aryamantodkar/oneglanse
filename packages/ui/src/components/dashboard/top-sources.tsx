"use client";

import { formatCitationLabel, getFaviconUrls } from "@oneglanse/utils";
import { FileQuestion } from "lucide-react";
import { Card } from "../card.js";
import { DashboardEmptyState } from "./empty-state.js";
import type { DashboardSourceData } from "./types.js";

export function TopSources({
	sources,
	totalCitations = 1,
}: {
	sources: DashboardSourceData[];
	totalCitations?: number;
}) {
	return (
		<Card className="flex h-full min-h-[500px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<div>
				<h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
					Top Sources
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Where AI pulls your brand narrative most often.
				</p>
			</div>

			{sources.length === 0 ? (
				<DashboardEmptyState
					icon={FileQuestion}
					title="No source data"
					description="No source intelligence is available for the selected filters."
				/>
			) : (
				<div className="flex min-w-0 flex-1 flex-col justify-around gap-3">
					{sources.slice(0, 5).map((source, idx) => {
						const faviconUrl =
							source.favicon || getFaviconUrls(source.domain, "")[0];

						const usagePercent = (
							(source.citationCount / totalCitations) *
							100
						).toFixed(1);

						return (
							<div
								key={source.domain}
								className="ui-list-item group flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 sm:flex-row sm:items-start sm:justify-between dark:border-gray-800 dark:bg-gray-900"
							>
								<div className="flex min-w-0 flex-1 items-start gap-3">
									<div className="flex min-w-0 flex-1 items-start gap-3">
										{faviconUrl && (
											<img
												src={faviconUrl}
												alt=""
												className="h-5 w-5 shrink-0 rounded-md object-contain transition-transform duration-200 group-hover:scale-105"
												onError={(e) => {
													(e.target as HTMLImageElement).style.visibility =
														"hidden";
												}}
											/>
										)}

										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
												{source.domain}
											</p>

											<div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
												<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-neutral-800">
													{formatCitationLabel(source.citationCount)}
												</span>
												<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-neutral-800">
													{source.models.size} models
												</span>
												<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-neutral-800">
													{source.uniqueRecords.size} responses
												</span>
												<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-neutral-800">
													#{idx + 1}
												</span>
											</div>
										</div>
									</div>
								</div>

								<div className="w-full shrink-0 text-left text-xs font-semibold text-gray-900 sm:w-auto sm:min-w-[4.5rem] sm:text-right dark:text-gray-100">
									{usagePercent}%
								</div>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
