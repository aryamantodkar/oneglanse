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
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">AI Perception</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-4">
					{/* Best Known For */}
					{bestKnownFor && (
						<div>
							<p className="mb-1.5 text-gray-400 text-xs">
								Best Known For
							</p>
							<p className="font-medium text-gray-900 text-sm leading-relaxed dark:text-gray-100">
								{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
							</p>
						</div>
					)}

					{/* Pricing */}
					<div>
						<p className="mb-1.5 text-gray-400 text-xs">
							Pricing
						</p>
						<span className="inline-flex items-center rounded px-2 py-1 bg-gray-100 text-gray-900 text-xs font-medium dark:bg-gray-800 dark:text-gray-100">
							{pricingLabels[pricingPerception] ?? pricingPerception}
						</span>
					</div>

					{/* Core Claims */}
					{coreClaims.length > 0 && (
						<div>
							<p className="mb-2 text-gray-400 text-xs">
								Key Claims
							</p>
							<ul className="space-y-1.5">
								{coreClaims.slice(0, 4).map((claim) => (
									<li key={claim} className="flex items-start gap-2">
										<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
										<span className="text-gray-700 text-xs leading-relaxed dark:text-gray-300">
											{claim.charAt(0).toUpperCase() + claim.slice(1)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
