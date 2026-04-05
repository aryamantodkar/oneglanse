import { FEATURE_ITEMS } from "@/lib/landing-content";
import { SectionHeading } from "@oneglanse/ui";

export function FeatureGrid(): React.JSX.Element {
	return (
		<section
			className="section-shell py-14 sm:py-16"
			id="features"
			aria-labelledby="features-title"
		>
			<SectionHeading
				eyebrow="Features"
				title="Built for teams that run GEO like infrastructure"
				description="High-signal workflows. Minimal noise."
			/>
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{FEATURE_ITEMS.map((feature) => {
					const Icon = feature.icon;
					return (
						<article
							key={feature.title}
							className="landing-soft-card px-5 py-5"
						>
							<span className="landing-muted-card mb-4 inline-flex h-11 w-11 items-center justify-center">
								<Icon
									className="h-5 w-5 text-muted-foreground"
									aria-hidden="true"
								/>
							</span>
							<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
								{feature.title}
							</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{feature.description}
							</p>
						</article>
					);
				})}
			</div>
		</section>
	);
}
