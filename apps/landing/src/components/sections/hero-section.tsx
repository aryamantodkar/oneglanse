import { DashboardBrowserPreview } from "@/components/previews/dashboard-browser-preview";

export function HeroSection(): React.JSX.Element {
	return (
		<section className="section-shell pb-12 pt-8 sm:pb-18 sm:pt-14">
			<div className="landing-surface mx-auto grid max-w-6xl items-center gap-8 overflow-hidden px-6 py-8 sm:px-8 sm:py-10 xl:grid-cols-[1.05fr_1fr] xl:gap-12 xl:px-10">
				<div className="ui-stagger">
					<h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
						The Open-Source AI Visibility & GEO Tracker.
					</h1>
					<p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
						Measure how your brand is perceived across major LLM providers and
						turn visibility, sentiment, and source data into better positioning.
					</p>
				</div>

				<div className="ui-page-enter">
					<DashboardBrowserPreview />
				</div>
			</div>
		</section>
	);
}
