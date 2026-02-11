import type { AnalysisRecord } from "@onescope/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@onescope/ui";
import { formatDate, getDomain, getFaviconUrls, getModelFavicon, modelSelectors } from "@onescope/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { getGeoScoreColor, getSentimentColor } from "../_utils/helpers";
import { recTypeColors, recTypeLabels, priorityColors, severityStyles, defaultSeverityStyle } from "../_utils/constants";
import { PillTag } from "./stats-row";

export function RecordDetailDialog({
	record,
	open,
	onClose,
}: {
	record: AnalysisRecord | null;
	open: boolean;
	onClose: () => void;
}) {
	if (!record || !record.brand_analysis) return null;

	const ba = record.brand_analysis!;
	const geoColor = getGeoScoreColor(ba.geoScore.overall);
	const sentimentColor = getSentimentColor(ba.sentiment.score);

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="!max-w-[90vw] !w-[90vw] sm:!max-w-[70vw] sm:!w-[70vw] flex h-[85vh] flex-col rounded-2xl px-8 pb-8 sm:px-10 sm:pt-10 sm:pb-10">
				<DialogHeader className="pb-4">
					<DialogTitle className="font-semibold text-lg">
						{record.prompt}
					</DialogTitle>
					<DialogDescription>
						<div className="mt-1 flex items-center gap-3">
							<img
								src={getModelFavicon(record.model_provider)}
								alt={record.model_provider}
								className="h-4 w-4 rounded-sm"
							/>
							<span>
								{modelSelectors.find((m) => m.value === record.model_provider)
									?.label || record.model_provider}
							</span>
							<span className="text-gray-400">&middot;</span>
							<span>{formatDate(record.prompt_run_at)}</span>
						</div>
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 space-y-6 overflow-y-auto pr-2">
					{/* GEO Score + Key Metrics */}
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								GEO Score
							</span>
							<span className="font-bold text-2xl" style={{ color: geoColor }}>
								{ba.geoScore.overall}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">Rank</span>
							<span className="font-bold text-2xl">
								{ba.position.rankPosition !== null
									? `#${ba.position.rankPosition}`
									: "—"}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								Sentiment
							</span>
							<span className={`font-bold text-2xl ${sentimentColor.text}`}>
								{ba.sentiment.score}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								Share of Voice
							</span>
							<span className="font-bold text-2xl">
								{ba.presence.shareOfVoice}%
							</span>
						</div>
					</div>

					{/* Verdict */}
					<div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
						<p className="mb-1 text-muted-foreground text-xs">Verdict</p>
						<p className="text-gray-700 text-sm dark:text-gray-300">
							{ba.geoScore.verdict}
						</p>
					</div>

					{/* Recommendation */}
					<div>
						<p className="mb-2 text-muted-foreground text-xs">Recommendation</p>
						<div className="flex flex-wrap items-center gap-3">
							<span
								className={`inline-flex items-center rounded-lg px-3 py-1 font-semibold text-sm ${recTypeColors[ba.recommendation.type] ?? ""}`}
							>
								{recTypeLabels[ba.recommendation.type] ??
									ba.recommendation.type}
							</span>
							{ba.recommendation.bestFor.map((tag) => (
								<PillTag key={tag} label={tag} />
							))}
						</div>
						{ba.recommendation.caveats.length > 0 && (
							<div className="mt-2 space-y-1">
								{ba.recommendation.caveats.map((caveat) => (
									<p
										key={caveat}
										className="text-muted-foreground text-xs italic"
									>
										{caveat}
									</p>
								))}
							</div>
						)}
					</div>

					{/* Sentiment Breakdown */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="mb-2 font-medium text-emerald-600 text-xs dark:text-emerald-400">
								Positives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.positives.map((p) => (
									<li
										key={p}
										className="flex items-start gap-1.5 text-gray-700 text-sm dark:text-gray-300"
									>
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
										{p}
									</li>
								))}
							</ul>
						</div>
						<div>
							<p className="mb-2 font-medium text-amber-600 text-xs dark:text-amber-400">
								Negatives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.negatives.map((n) => (
									<li
										key={n}
										className="flex items-start gap-1.5 text-gray-700 text-sm dark:text-gray-300"
									>
										<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
										{n}
									</li>
								))}
							</ul>
						</div>
					</div>

					{/* Competitors */}
					{ba.competitors.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Competitors</p>
							<div className="space-y-2">
								{ba.competitors.map((comp) => (
									<div
										key={comp.name}
										className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50"
									>
										<div className="flex items-center gap-3">
											<span className="font-medium text-sm">{comp.name}</span>
											{comp.rankPosition !== null && (
												<span className="text-muted-foreground text-xs">
													#{comp.rankPosition}
												</span>
											)}
											{comp.isRecommended && (
												<span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
													Recommended
												</span>
											)}
										</div>
										<span
											className={`font-medium text-sm ${getSentimentColor(comp.sentiment).text}`}
										>
											{comp.sentiment}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Perception */}
					{ba.perception.bestKnownFor && (
						<div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
							<p className="mb-1 text-muted-foreground text-xs">
								Best known for
							</p>
							<p className="font-medium text-sm">
								{ba.perception.bestKnownFor}
							</p>
							{ba.perception.differentiators.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{ba.perception.differentiators.map((d) => (
										<PillTag key={d} label={d} />
									))}
								</div>
							)}
						</div>
					)}

					{/* Risks */}
					{ba.risks.hasRisks && ba.risks.items.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Risks</p>
							<div className="space-y-2">
								{ba.risks.items.map((risk, i) => {
									const style =
										severityStyles[risk.severity] ?? defaultSeverityStyle;
									return (
										<div
											key={i}
											className={`rounded-lg border p-3 ${style.bg} ${style.border}`}
										>
											<span
												className={`font-semibold text-xs uppercase ${style.text}`}
											>
												{risk.severity}
											</span>
											<p className={`mt-0.5 text-sm ${style.text}`}>
												{risk.detail}
											</p>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Actions */}
					{ba.actions.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Actions</p>
							<div className="space-y-2">
								{ba.actions.map((action, i) => (
									<div key={i} className="flex items-start gap-2">
										<span
											className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColors[action.priority] ?? "bg-gray-400"}`}
										/>
										<div>
											<span className="font-semibold text-[10px] text-muted-foreground uppercase">
												{action.priority}
											</span>
											<p className="text-gray-700 text-sm dark:text-gray-300">
												{action.recommendation}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Sources */}
					{record.sources.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Sources</p>
							<div className="flex flex-wrap gap-2">
								{record.sources.map((source, i) => {
									const favicon =
										source.favicon || getFaviconUrls(source.url, "")[0];
									return (
										<a
											key={`${source.url}-${i}`}
											href={source.url}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 rounded-md border border-gray-200/60 bg-gray-50/50 px-2.5 py-1.5 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-800/60 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800"
										>
											{favicon && (
												<img
													src={favicon}
													alt=""
													className="h-3.5 w-3.5 rounded-sm opacity-75"
												/>
											)}
											<span className="max-w-[200px] truncate">
												{source.title || getDomain(source.url)}
											</span>
										</a>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
