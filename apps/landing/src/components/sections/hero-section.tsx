import { DashboardBrowserPreview } from "@/components/previews/dashboard-browser-preview";
import { PRODUCT_POSITIONING } from "@/lib/landing-content";

export function HeroSection(): React.JSX.Element {
	return (
		<section className="section-shell pb-12 pt-8 sm:pb-18 sm:pt-14">
			<div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-8 sm:px-8 sm:py-10 xl:grid-cols-[1.05fr_1fr] xl:gap-12 xl:px-10">
				<div className="ui-stagger">
					<h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
						{PRODUCT_POSITIONING}
					</h1>
					<p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
						Run your prompts on ChatGPT, Perplexity, Gemini, Claude, and Google
						AI Overview. OneGlanse opens the real websites, saves the answers
						and citations, and lets you compare runs over time.
					</p>
					<p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
						Connect your own analysis model to see visibility, rank, sentiment,
						and recommendations. Free and open source. Run it on your laptop or
						your own server.
					</p>
				</div>

				<div className="ui-page-enter">
					<DashboardBrowserPreview />
				</div>
			</div>
		</section>
	);
}
