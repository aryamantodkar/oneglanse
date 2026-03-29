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
		<Card className="flex h-full min-h-[460px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
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
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					{pricingPerception !== "not_mentioned" && (
						<div className="ui-list-item rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3 dark:border-amber-900/60 dark:bg-amber-950/25">
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
						<div className="ui-list-item rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
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
										className="ui-list-item grid min-w-0 grid-cols-[auto,1fr] items-start gap-x-2 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed dark:border-gray-800 dark:bg-black"
									>
										<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
										<span className="min-w-0 break-words [overflow-wrap:anywhere]">
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
										className="ui-list-item min-w-0 max-w-full rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-muted-foreground dark:border-gray-700 dark:bg-neutral-900"
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
