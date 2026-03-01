import { Info } from "lucide-react";
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
		<Card className="flex h-full min-h-[500px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
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
				<div className="flex flex-1 flex-col gap-4">
					{pricingPerception !== "not_mentioned" && (
						<div className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Pricing Signal
							</p>
							<p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
								{pricingLabels[pricingPerception] ?? pricingPerception}
							</p>
						</div>
					)}

					{bestKnownFor && (
						<div className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900">
							<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Best Known For
							</p>
							<p className="mt-2 text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">
								{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
							</p>
						</div>
					)}

					{coreClaims.length > 0 && (
						<div>
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Key Claims
							</p>
							<ul className="space-y-2">
								{coreClaims.slice(0, 4).map((claim) => (
									<li
										key={claim}
										className="ui-list-item flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed dark:border-gray-800 dark:bg-gray-900"
									>
										<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
										<span>{claim.charAt(0).toUpperCase() + claim.slice(1)}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{differentiators.length > 0 && (
						<div>
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Differentiators
							</p>
							<div className="flex flex-wrap gap-2">
								{differentiators.slice(0, 5).map((diff) => (
									<span
										key={diff}
										className="ui-list-item rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800"
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
