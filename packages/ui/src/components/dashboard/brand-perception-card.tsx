import { BadgeDollarSign, Info, Lightbulb, Tags } from "lucide-react";
import { Card } from "../card.js";
import { DashboardEmptyState } from "./empty-state.js";

const pricingLabels: Record<string, string> = {
	premium: "Premium",
	mid_range: "Mid-range",
	budget: "Budget",
	free: "Free",
	not_mentioned: "Not mentioned",
};

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
	const hasData =
		bestKnownFor || coreClaims.length > 0 || differentiators.length > 0;

	return (
		<Card className="flex h-full min-w-0 flex-col p-5 lg:p-6">
			<div>
				<h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
					AI Perception
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					What large models say most about you.
				</p>
			</div>

			{!hasData ? (
				<DashboardEmptyState
					icon={Info}
					title="No perception data"
					description="No brand perception signals are available for the selected filters."
				/>
			) : (
				<div className="flex min-w-0 flex-1 flex-col gap-3.5">
					{pricingPerception !== "not_mentioned" && (
						<div className="ui-list-item rounded-[22px] border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 dark:border-amber-900/60 dark:bg-amber-950/25">
							<p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
								<BadgeDollarSign className="h-3.5 w-3.5" />
								Pricing Signal
							</p>
							<p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
								{pricingLabels[pricingPerception] ?? pricingPerception}
							</p>
						</div>
					)}

					{bestKnownFor && (
						<div className="ui-list-item rounded-[22px] border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
							<p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
								<Lightbulb className="h-3.5 w-3.5" />
								Best Known For
							</p>
							<p className="mt-2 text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">
								{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
							</p>
						</div>
					)}

					{coreClaims.length > 0 && (
						<div className="min-w-0">
							<p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								<Tags className="h-3.5 w-3.5" />
								Key Claims
							</p>
							<ul className="space-y-2">
								{coreClaims.slice(0, 4).map((claim) => (
									<li
										key={claim}
										className="ui-list-item flex min-w-0 items-start gap-2 rounded-[20px] border border-gray-100/80 bg-white px-3 py-2 text-xs leading-relaxed dark:border-gray-800 dark:bg-neutral-950"
									>
										<span className="mt-[0.38rem] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
										<span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
											{claim.charAt(0).toUpperCase() + claim.slice(1)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{differentiators.length > 0 && (
						<div className="min-w-0">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Differentiators
							</p>
							<div className="flex flex-wrap gap-2">
								{differentiators.slice(0, 5).map((diff) => (
									<span
										key={diff}
										className="ui-list-item min-w-0 max-w-full rounded-full border border-transparent bg-stone-50 px-3 py-1 text-[11px] font-semibold text-gray-500 dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400"
									>
										{diff.charAt(0).toUpperCase() + diff.slice(1)}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
