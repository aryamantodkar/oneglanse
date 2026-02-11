import React, { useState } from "react";
import type { AnalysisRecord } from "@onescope/types";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@onescope/ui";
import { getModelFavicon, modelSelectors } from "@onescope/utils";
import { ChevronDown, ExternalLink } from "lucide-react";
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
	const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">Query Performance</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="overflow-hidden rounded-b-xl">
					<Table className="min-w-full">
						<TableHeader>
							<TableRow className="border-gray-100 border-b bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/40">
								<TableHead className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Query
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Models
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Avg Score
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Best Rank
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Avg Sentiment
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Top Rec.
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{groupedRecords.map((group) => {
								const isExpanded = expandedPrompt === group.prompt;
								const geoColor = getGeoScoreColor(group.avgScore);
								const sentimentColor = getSentimentColor(group.avgSentiment);

								return (
									<React.Fragment key={group.prompt}>
										<TableRow
											onClick={() =>
												setExpandedPrompt(isExpanded ? null : group.prompt)
											}
											className="cursor-pointer border-gray-100/50 border-b transition-colors hover:bg-gray-50 dark:border-gray-800/40 dark:hover:bg-gray-900/60"
										>
											<TableCell className="max-w-md px-4 py-4">
												<div className="flex items-center gap-2">
													<ChevronDown
														className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
													/>
													<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
														{group.prompt}
													</span>
												</div>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<div className="flex items-center justify-center gap-1">
													{group.records.map((r) => (
														<img
															key={r.id}
															src={getModelFavicon(r.model_provider)}
															alt={r.model_provider}
															title={
																modelSelectors.find(
																	(m) => m.value === r.model_provider,
																)?.label
															}
															className="h-4 w-4 rounded-sm"
														/>
													))}
												</div>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className="font-bold text-sm"
													style={{ color: geoColor }}
												>
													{group.avgScore}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
													{group.bestRank ? `#${group.bestRank}` : "—"}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className={`font-bold text-sm ${sentimentColor.text}`}
												>
													{group.avgSentiment}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className={`inline-flex items-center rounded-md px-2.5 py-1 font-semibold text-xs ${recTypeColors[group.topRecType] ?? recTypeColors.not_mentioned}`}
												>
													{recTypeLabels[group.topRecType] ?? group.topRecType}
												</span>
											</TableCell>
										</TableRow>

										{/* Expanded Model Details */}
										{isExpanded && (
											<TableRow className="bg-gray-50/50 dark:bg-gray-900/20">
												<TableCell colSpan={6} className="px-8 py-4">
													<div className="space-y-2">
														<p className="mb-3 font-medium text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
															Model-Specific Results
														</p>
														<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
															{group.records.map((record) => {
																const ba = record.brand_analysis!;
																const recColor = getGeoScoreColor(
																	ba.geoScore.overall,
																);
																const sentColor = getSentimentColor(
																	ba.sentiment.score,
																);

																return (
																	<button
																		key={record.id}
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			onSelectRecord(record.prompt);
																		}}
																		className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-gray-700"
																	>
																		<div className="flex items-center gap-3">
																			<img
																				src={getModelFavicon(
																					record.model_provider,
																				)}
																				alt={record.model_provider}
																				className="h-5 w-5 rounded-sm"
																			/>
																			<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
																				{modelSelectors.find(
																					(m) => m.value === record.model_provider,
																				)?.label}
																			</span>
																		</div>
																		<div className="flex items-center gap-4">
																			<div className="text-right">
																				<span
																					className="block font-bold text-xs"
																					style={{ color: recColor }}
																				>
																					{ba.geoScore.overall} Score
																				</span>
																				<span
																					className={`block text-xs ${sentColor.text}`}
																				>
																					{ba.sentiment.score} Sentiment
																				</span>
																			</div>
																			<ExternalLink className="h-4 w-4 text-gray-400" />
																		</div>
																	</button>
																);
															})}
														</div>
													</div>
												</TableCell>
											</TableRow>
										)}
									</React.Fragment>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
