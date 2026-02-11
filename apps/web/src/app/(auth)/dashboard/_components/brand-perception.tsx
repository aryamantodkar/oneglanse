import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { pricingLabels } from "../_utils/constants";

export function BrandPerceptionCard({
	bestKnownFor,
	pricingPerception,
	coreClaims,
	differentiators,
}: {
	bestKnownFor: string | null;
	pricingPerception: string;
	coreClaims: string[];
	differentiators: string[];
}) {
	return (
		<Card className="relative overflow-hidden border-none bg-white/80 shadow-sm ring-1 ring-slate-100 backdrop-blur-sm dark:bg-slate-900/70 dark:ring-slate-800">
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
			<div className="pointer-events-none absolute right-[-18%] top-[-35%] h-44 w-44 rounded-full bg-violet-500/12 blur-3xl" />
			<CardHeader className="relative pb-3 px-5 pt-5">
				<p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
					Brand Narrative
				</p>
				<CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
					AI Perception
				</CardTitle>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					What large models say most about you.
				</p>
			</CardHeader>
			<CardContent className="relative px-5 pb-5 pt-0">
				<div className="space-y-4">
					{/* Best Known For */}
					{bestKnownFor && (
						<div className="rounded-lg border border-slate-100/80 bg-white/80 px-3 py-3 shadow-[0_12px_30px_-26px_rgba(88,28,135,0.45)] dark:border-slate-800/80 dark:bg-slate-900/70">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Best Known For
							</p>
							<p className="mt-1 text-sm font-semibold text-slate-900 leading-relaxed dark:text-white">
								{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
							</p>
						</div>
					)}

					{/* Pricing */}
					<div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold ring-1 ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-800">
						<span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-white dark:bg-white dark:text-slate-900">
							Pricing
						</span>
						<span className="text-slate-800 dark:text-slate-100">
							{pricingLabels[pricingPerception] ?? pricingPerception}
						</span>
					</div>

					{/* Core Claims */}
					{coreClaims.length > 0 && (
						<div>
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Key Claims
							</p>
							<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{coreClaims.slice(0, 4).map((claim) => (
									<li
										key={claim}
										className="flex items-start gap-2 rounded-lg border border-slate-100/70 bg-white/85 px-3 py-2 text-xs leading-relaxed shadow-[0_12px_32px_-28px_rgba(71,85,105,0.45)] dark:border-slate-800/70 dark:bg-slate-900/60"
									>
										<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
										<span className="text-slate-800 dark:text-slate-200">
											{claim.charAt(0).toUpperCase() + claim.slice(1)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Differentiators */}
					{differentiators.length > 0 && (
						<div>
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
								Differentiators
							</p>
							<div className="flex flex-wrap gap-2">
								{differentiators.slice(0, 5).map((diff) => (
									<span
										key={diff}
										className="rounded-full bg-slate-100/80 px-3 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-100 dark:ring-slate-700"
									>
										{diff.charAt(0).toUpperCase() + diff.slice(1)}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
