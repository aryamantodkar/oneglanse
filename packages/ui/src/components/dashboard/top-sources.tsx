"use client";

import { formatCitationLabel, getFaviconUrls } from "@oneglanse/utils";
import { Card } from "../card.js";
import type { DashboardSourceData } from "./types.js";

export function TopSources({
	sources,
	totalCitations = 1,
}: {
	sources: DashboardSourceData[];
	totalCitations?: number;
}) {
	const visibleSources = sources.slice(0, 5);

	return (
		<Card className="flex h-full min-w-0 flex-col p-5 lg:p-6">
			<div>
				<h1 className="mt-2 text-base font-semibold leading-none tracking-tight text-gray-900 sm:text-lg dark:text-gray-100">
					Top Sources
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Where AI pulls your brand narrative most often.
				</p>
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-3">
				{visibleSources.map((source, idx) => {
					const faviconUrl =
						source.favicon || getFaviconUrls(source.domain, "")[0];

					const usagePercent = (
						(source.citationCount / totalCitations) *
						100
					).toFixed(1);

					return (
						<div
							key={source.domain}
							className="ui-list-item group grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 rounded-[var(--app-radius)] border border-gray-100/80 bg-white px-4 py-3 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] hover:border-gray-200 hover:bg-stone-50 dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] dark:hover:bg-neutral-900"
						>
							<div className="flex min-w-0 items-start gap-3">
								{faviconUrl && (
									<img
										src={faviconUrl}
										alt=""
										className="h-5 w-5 shrink-0 rounded-[var(--app-radius)] object-contain transition-transform duration-200 group-hover:scale-105"
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
										<span className="rounded-[var(--app-radius)] border border-transparent bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400">
											{formatCitationLabel(source.citationCount)}
										</span>
										<span className="rounded-[var(--app-radius)] border border-transparent bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400">
											{source.models.size} models
										</span>
										<span className="rounded-[var(--app-radius)] border border-transparent bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400">
											{source.uniqueRecords.size} responses
										</span>
										<span className="rounded-[var(--app-radius)] border border-transparent bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400">
											#{idx + 1}
										</span>
									</div>
								</div>
							</div>

							<div className="flex min-w-[4.75rem] items-center justify-center text-center text-xs font-semibold text-gray-900 dark:text-gray-100">
								{usagePercent}%
							</div>
						</div>
					);
				})}
			</div>
		</Card>
	);
}
