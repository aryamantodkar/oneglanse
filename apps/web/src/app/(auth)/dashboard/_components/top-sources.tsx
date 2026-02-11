import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import type { SourceData } from "../_utils/types";

export function TopSources({
	sources,
	totalRecords = 1,
}: {
	sources: SourceData[];
	totalRecords?: number;
}) {
	if (sources.length === 0) return null;

	return (
		<Card className="relative overflow-hidden border-none bg-white/80 shadow-sm ring-1 ring-slate-100 backdrop-blur-sm dark:bg-slate-900/70 dark:ring-slate-800">
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
			<div className="pointer-events-none absolute -left-12 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
			<CardHeader className="relative pb-3 px-5 pt-5">
				<p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
					Signal Density
				</p>
				<CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
					Top Sources
				</CardTitle>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					Where AI pulls your brand narrative most often.
				</p>
			</CardHeader>
			<CardContent className="relative px-5 pb-5 pt-0">
				<div className="space-y-3">
					{sources.slice(0, 5).map((source, idx) => {
						const faviconUrl =
							source.favicon || getFaviconUrls(source.domain, "")[0];
						const usagePercent = Math.round((source.uniqueRecords.size / totalRecords) * 100);

						return (
							<div
								key={source.domain}
								className="flex items-center gap-3 rounded-xl border border-slate-100/70 bg-white/85 px-3 py-3 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_-28px_rgba(56,189,248,0.45)] dark:border-slate-800/70 dark:bg-slate-900/60"
							>
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
									{idx + 1}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										{faviconUrl && (
											<img
												src={faviconUrl}
												alt=""
												className="h-4 w-4 shrink-0 rounded-sm"
												onError={(e) => {
													(e.target as HTMLImageElement).style.display = "none";
												}}
											/>
										)}
										<p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
											{source.domain}
										</p>
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
										<span className="flex items-center gap-1">
											<span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
											{usagePercent}% usage
										</span>
										<span className="flex items-center gap-1">
											<span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
											{source.citationCount} citations
										</span>
									</div>
								</div>
								<div className="w-14 text-right text-xs font-semibold text-slate-900 dark:text-white">
									{usagePercent}%
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
