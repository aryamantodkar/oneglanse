import { Card } from "@oneglanse/ui";
import { getFaviconUrls } from "@oneglanse/utils";
import { FileQuestion } from "lucide-react";
import type { SourceData } from "../_utils/types";
import { DashboardEmptyState } from "./empty-state";

function formatCitationLabel(count: number): string {
	return `${count} citation${count === 1 ? "" : "s"}`;
}

export function TopSources({
	sources,
	totalCitations = 1,
}: {
	sources: SourceData[];
	totalCitations?: number;
}): React.JSX.Element {
	return (
		<Card className="flex h-full min-h-[500px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			{/* Header */}
			<div>
				<h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
					Top Sources
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Where AI pulls your brand narrative most often.
				</p>
			</div>

			{/* Source List */}
			{sources.length === 0 ? (
				<DashboardEmptyState
					icon={FileQuestion}
					title="No source data"
					description="No source intelligence is available for the selected filters."
				/>
			) : (
				<div className="flex flex-1 flex-col justify-around">
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
								className="ui-list-item group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
							>
								{/* LEFT SIDE (Rank + Content) */}
								<div className="flex items-center gap-3 min-w-0 flex-1">
									{/* Icon + Content */}
									<div className="flex items-center gap-3 min-w-0 flex-1">
										{/* Icon */}
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

										{/* Content */}
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
												{source.domain}
											</p>

											<div className="mt-1.5 flex items-center gap-2">
												<span className="text-xs text-muted-foreground">
													{formatCitationLabel(source.citationCount)}
												</span>
												<span className="text-[10px] text-muted-foreground">
													{source.models.size} models
												</span>
												<span className="text-[10px] text-muted-foreground">
													{source.uniqueRecords.size} responses
												</span>
												<span className="text-[10px] text-muted-foreground">
													#{idx + 1}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* RIGHT SIDE (Percentage) */}
								<div className="w-10 shrink-0 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
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
