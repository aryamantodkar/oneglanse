import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { CheckCircle2 } from "lucide-react";

const PROVIDER_ITEMS = modelSelectors.filter(
	(item) => item.value !== "All Models",
);

export function SupportedProvidersSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="supported-providers"
			aria-labelledby="supported-providers-title"
		>
			<div className="mb-6 sm:mb-8">
				<h2
					id="supported-providers-title"
					className="text-2xl font-semibold tracking-tight sm:text-3xl"
				>
					Supported Providers
				</h2>
				<p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
					Unified tracking across all LLM providers with consistent metrics and
					source-level evidence.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{PROVIDER_ITEMS.map((provider) => (
					<article
						key={provider.value}
						className="landing-soft-card group px-4 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5"
					>
						<div className="flex items-center justify-between">
							<span className="inline-flex items-center gap-2">
								<img
									src={getModelFavicon(provider.value)}
									alt={provider.label}
									className="h-5 w-5 rounded-sm opacity-90 transition-opacity duration-200 group-hover:opacity-100"
								/>
								<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
									{provider.label}
								</span>
							</span>
							<CheckCircle2
								className="h-4 w-4 text-emerald-600 transition-transform duration-200 group-hover:scale-110 dark:text-emerald-400"
								aria-hidden="true"
							/>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
