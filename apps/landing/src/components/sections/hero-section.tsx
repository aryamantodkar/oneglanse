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
						Run prompts through the real ChatGPT, Perplexity, Gemini, Claude,
						and Google AI Overview interfaces. OneGlanse extracts rendered
						responses and citations. Provider collection does not use model
						APIs; a separate model endpoint you configure analyzes the captured
						responses afterward.
					</p>
				</div>

				<div className="ui-page-enter">
					<DashboardBrowserPreview />
				</div>
			</div>
			<p className="mx-auto max-w-6xl px-6 text-center text-xs leading-5 text-muted-foreground sm:px-8 xl:px-10">
				Dashboard figures and response examples on this page use illustrative
				sample data.
			</p>
		</section>
	);
}
