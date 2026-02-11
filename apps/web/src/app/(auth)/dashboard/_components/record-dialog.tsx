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
			<DialogContent className="relative !max-w-[90vw] !w-[90vw] sm:!max-w-[70vw] sm:!w-[70vw] flex h-[85vh] flex-col overflow-hidden rounded-2xl border-none bg-white/90 px-8 pb-8 shadow-2xl ring-1 ring-slate-100 backdrop-blur-xl dark:bg-slate-950/85 dark:ring-slate-800 sm:px-10 sm:pt-10 sm:pb-10">
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-black" />
				<div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl dark:bg-white/5" />
				<div className="pointer-events-none absolute right-[-18%] top-[-18%] h-72 w-72 rounded-full bg-violet-500/10 blur-3xl dark:bg-white/5" />

				<DialogHeader className="relative pb-4">
					<p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
						Prompt Detail
					</p>
					<DialogTitle className="font-semibold text-xl leading-snug text-slate-900 dark:text-white">
						{record.prompt}
					</DialogTitle>
					<DialogDescription>
						<div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
							<span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-semibold dark:bg-white dark:text-slate-900">
								<img
									src={getModelFavicon(record.model_provider)}
									alt={record.model_provider}
									className="h-4 w-4 rounded-sm"
								/>
								{modelSelectors.find((m) => m.value === record.model_provider)
									?.label || record.model_provider}
							</span>
							<span className="text-slate-400">&middot;</span>
							<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
								{formatDate(record.prompt_run_at)}
							</span>
						</div>
					</DialogDescription>
				</DialogHeader>

				<div className="relative flex-1 space-y-6 overflow-y-auto pr-2">
					{/* GEO Score + Key Metrics */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{[
							{ label: "GEO Score", value: ba.geoScore.overall, color: geoColor },
							{
								label: "Rank",
								value:
									ba.position.rankPosition !== null
										? `#${ba.position.rankPosition}`
										: "—",
								color: undefined,
							},
							{
								label: "Sentiment",
								value: ba.sentiment.score,
								color: sentimentColor.text,
							},
							{ label: "Share of Voice", value: `${ba.presence.visibility}%`, color: undefined },
						].map((item) => (
							<div
								key={item.label}
								className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70"
							>
								<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
									{item.label}
								</span>
								<span
									className={`text-xl font-semibold text-slate-900 dark:text-white ${item.color ?? ""}`}
									style={item.color && !item.color.includes("text-") ? { color: item.color } : {}}
								>
									{item.value}
								</span>
							</div>
						))}
					</div>

					{/* Verdict */}
					<div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
						<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
							Verdict
						</p>
						<p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
							{ba.geoScore.verdict}
						</p>
					</div>

					{/* Recommendation */}
					<div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
						<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
							Recommendation
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${recTypeColors[ba.recommendation.type] ?? ""}`}
							>
								{recTypeLabels[ba.recommendation.type] ??
									ba.recommendation.type}
							</span>
							{ba.recommendation.bestFor.map((tag) => (
								<PillTag
									key={tag}
									label={tag}
									className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
								/>
							))}
						</div>
						{ba.recommendation.caveats.length > 0 && (
							<div className="space-y-1 rounded-xl bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
								{ba.recommendation.caveats.map((caveat) => (
									<p key={caveat} className="leading-relaxed">
										{caveat}
									</p>
								))}
							</div>
						)}
					</div>

					{/* Sentiment Breakdown */}
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/60 px-4 py-3 shadow-[0_12px_32px_-28px_rgba(16,185,129,0.45)] dark:border-emerald-900/50 dark:bg-emerald-950/20">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
								Positives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.positives.map((p) => (
									<li
										key={p}
										className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100"
									>
										<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
										{p}
									</li>
								))}
							</ul>
						</div>
						<div className="rounded-2xl border border-amber-100/80 bg-amber-50/60 px-4 py-3 shadow-[0_12px_32px_-28px_rgba(251,191,36,0.45)] dark:border-amber-900/50 dark:bg-amber-950/20">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
								Negatives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.negatives.map((n) => (
									<li
										key={n}
										className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100"
									>
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
										{n}
									</li>
								))}
							</ul>
						</div>
					</div>

					{/* Competitors */}
					{ba.competitors.length > 0 && (
						<div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Competitors
							</p>
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{ba.competitors.map((comp) => (
									<div
										key={comp.name}
										className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800/70 dark:bg-slate-900/60"
									>
										<div className="flex items-center gap-2">
											<span className="font-semibold text-sm text-slate-900 dark:text-white">
												{comp.name}
											</span>
											{comp.rankPosition !== null && (
												<span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
													#{comp.rankPosition}
												</span>
											)}
											{comp.isRecommended && (
												<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
													Recommended
												</span>
											)}
										</div>
										<span
											className={`text-sm font-semibold ${getSentimentColor(comp.sentiment).text}`}
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
						<div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Best known for
							</p>
							<p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
								{ba.perception.bestKnownFor}
							</p>
							{ba.perception.differentiators.length > 0 && (
								<div className="mt-3 flex flex-wrap gap-2">
									{ba.perception.differentiators.map((d) => (
										<PillTag
											key={d}
											label={d}
											className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
										/>
									))}
								</div>
							)}
						</div>
					)}

					{/* Risks */}
					{ba.risks.hasRisks && ba.risks.items.length > 0 && (
						<div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Risks
							</p>
							<div className="space-y-2">
								{ba.risks.items.map((risk, i) => {
									const style =
										severityStyles[risk.severity] ?? defaultSeverityStyle;
									return (
										<div
											key={i}
											className={`rounded-xl border px-3 py-3 ${style.bg} ${style.border}`}
										>
											<span
												className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.text}`}
											>
												<span className={`h-2 w-2 rounded-full ${style.dot}`} />
												{risk.severity}
											</span>
											<p className={`mt-1 text-sm leading-relaxed ${style.text}`}>
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
						<div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Actions
							</p>
							<div className="space-y-2">
								{ba.actions.map((action, i) => (
									<div
										key={i}
										className="flex items-start gap-3 rounded-xl border border-slate-100/80 bg-slate-50/80 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-900/50"
									>
										<span
											className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColors[action.priority] ?? "bg-gray-400"}`}
										/>
										<div>
											<span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
												{action.priority}
											</span>
											<p className="mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
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
						<div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Sources
							</p>
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
											className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-200"
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
