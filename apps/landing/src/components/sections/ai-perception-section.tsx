import { PREVIEW_PERCEPTION } from "@/lib/preview-data";
import { BrandPerceptionCard } from "@oneglanse/ui";
import { CheckCircle2 } from "lucide-react";

export function AiPerceptionSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="ai-perception"
			aria-labelledby="ai-perception-title"
		>
			<div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
				<div className="flex min-h-0 flex-col justify-center lg:min-h-[500px]">
					<div>
						<h2
							id="ai-perception-title"
							className="text-2xl font-semibold tracking-tight sm:text-3xl"
						>
							AI Perception
						</h2>
						<p className="mt-2 max-w-xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
							Review themes and claims that the configured analysis model finds in
							captured answers.
						</p>
					</div>

					<ul className="mt-6 space-y-3">
						<li className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							Themes are derived from captured provider responses by the configured
							analysis model
						</li>
						<li className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							Pricing and positioning observations are model-backed interpretations
						</li>
						<li className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							Compare extracted claims across captured responses to review
							consistency and change
						</li>
						<li className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							Inspect how captured answers describe a brand and its differentiators
						</li>
						<li className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							Review differences between runs without treating them as predictions
						</li>
					</ul>
				</div>

				<div className="min-w-0">
					<BrandPerceptionCard
						bestKnownFor={PREVIEW_PERCEPTION.bestKnownFor}
						pricingPerception={PREVIEW_PERCEPTION.pricingPerception}
						coreClaims={[...PREVIEW_PERCEPTION.coreClaims]}
						differentiators={[...PREVIEW_PERCEPTION.differentiators]}
					/>
				</div>
			</div>
		</section>
	);
}
