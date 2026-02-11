import React from "react";
import type { AnalysisRecord } from "@onescope/types";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@onescope/ui";
import { getModelFavicon, modelSelectors } from "@onescope/utils";
import { ExternalLink } from "lucide-react";
import { getGeoScoreColor, getSentimentColor } from "../_utils/helpers";
import { recTypeColors, recTypeLabels } from "../_utils/constants";

export function QueryLevelTable({
	groupedRecords,
	onSelectRecord,
}: {
	groupedRecords: Array<{
		prompt: string;
		records: AnalysisRecord[];
		avgScore: number;
		avgSentiment: number;
		bestRank: number | null;
		topRecType: string;
	}>;
	onSelectRecord: (prompt: string) => void;
}) {
	return (
		<Card className="relative overflow-hidden border-none bg-white/80 shadow-sm ring-1 ring-slate-100 backdrop-blur-sm dark:bg-slate-900/70 dark:ring-slate-800">
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
			<div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-slate-900/5 blur-3xl dark:bg-white/5" />
			<CardHeader className="relative pb-3 px-5 pt-5">
				<p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
					Query Intelligence
				</p>
				<CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
					Query Performance
				</CardTitle>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					Compare prompts by coverage, sentiment, and recommendation strength.
				</p>
			</CardHeader>
			<CardContent className="relative space-y-3 px-4 pb-6 pt-1 sm:px-5">
				{groupedRecords.map((group) => {
					const geoColor = getGeoScoreColor(group.avgScore);
					const sentimentColor = getSentimentColor(group.avgSentiment);

					return (
						<div
							key={group.prompt}
							className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm transition hover:-translate-y-[1px] hover:shadow-[0_22px_52px_-30px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70"
						>
							<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div className="space-y-1">
									<p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">
										{group.prompt}
									</p>
									<div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
										<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
											{group.records.length} model{group.records.length !== 1 ? "s" : ""}
										</span>
										<span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
										<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
											{recTypeLabels[group.topRecType] ?? group.topRecType}
										</span>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:min-w-[320px]">
									<span
										className="inline-flex items-center justify-between rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:bg-white/10 dark:text-white"
										style={{ color: geoColor }}
									>
										<span>Avg Score</span>
										<span>{group.avgScore}</span>
									</span>
									<span className="inline-flex items-center justify-between rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
										<span>Rank</span>
										<span>{group.bestRank ? `#${group.bestRank}` : "—"}</span>
									</span>
									<span
										className={`inline-flex items-center justify-between rounded-full px-3 py-1.5 text-xs font-semibold ${sentimentColor.text} bg-slate-900/5 dark:bg-white/10`}
									>
										<span>Sentiment</span>
										<span>{group.avgSentiment}</span>
									</span>
									<span
										className={`inline-flex items-center justify-between rounded-full px-3 py-1.5 text-[11px] font-semibold ${recTypeColors[group.topRecType] ?? recTypeColors.not_mentioned}`}
									>
										<span>Top Rec</span>
										<span>{recTypeLabels[group.topRecType] ?? group.topRecType}</span>
									</span>
								</div>
							</div>

							<div className="mt-4">
								<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
									Model-Specific Results
								</p>
								<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
									{group.records.map((record) => {
										const ba = record.brand_analysis!;
										const recColor = getGeoScoreColor(ba.geoScore.overall);
										const sentColor = getSentimentColor(ba.sentiment.score);

										return (
											<button
												key={record.id}
												type="button"
												onClick={() => onSelectRecord(record.prompt)}
												className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-left shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_22px_52px_-30px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70"
											>
												<div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/40 via-white/10 to-transparent dark:from-white/5 dark:via-white/0 dark:to-transparent" />
												<div className="flex items-center gap-3">
													<img
														src={getModelFavicon(record.model_provider)}
														alt={record.model_provider}
														className="h-6 w-6 rounded-md border border-white shadow-sm dark:border-slate-800"
													/>
													<span className="font-semibold text-slate-900 text-sm dark:text-white">
														{modelSelectors.find(
															(m) => m.value === record.model_provider,
														)?.label}
													</span>
												</div>
												<div className="flex items-center gap-4">
													<div className="text-right">
														<span
															className="block text-xs font-semibold"
															style={{ color: recColor }}
														>
															{ba.geoScore.overall} Score
														</span>
														<span
															className={`block text-[11px] font-semibold ${sentColor.text}`}
														>
															{ba.sentiment.score} Sentiment
														</span>
													</div>
													<ExternalLink className="h-4 w-4 text-slate-400 transition group-hover:text-slate-600 dark:group-hover:text-slate-200" />
												</div>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
