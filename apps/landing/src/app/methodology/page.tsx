import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { PRODUCT_POSITIONING, SITE_URLS } from "@/lib/landing-content";
import type { Metadata } from "next";

const title = "AI Visibility Tracking Methodology";
const description =
	"Learn how OneGlanse collects rendered AI product responses, analyzes them with a configured model endpoint, and compares results without treating samples as universal benchmarks.";

export const metadata: Metadata = {
	title: `${title} | OneGlanse`,
	description,
	alternates: {
		canonical: SITE_URLS.methodology,
	},
	openGraph: {
		title: `${title} | OneGlanse`,
		description,
		url: SITE_URLS.methodology,
	},
	twitter: {
		title: `${title} | OneGlanse`,
		description,
	},
};

const comparisonFields = [
	"Exact prompt text and any system or follow-up context",
	"Product interface or API, model/version when available, and run time",
	"Account state, language, location, and enabled search or grounding options",
	"Rendered answer text, named brands, recommendation order, and citation URLs",
	"Number of attempts, incomplete runs, and any exclusions",
];

export default function MethodologyPage(): React.JSX.Element {
	return (
		<>
			<SiteHeader />
			<main className="section-shell py-12 sm:py-16">
				<article className="mx-auto max-w-4xl">
					<header className="mb-10">
						<p className="text-sm font-medium text-muted-foreground">
							OneGlanse methodology
						</p>
						<h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
							How OneGlanse collects and analyzes AI answers
						</h1>
						<p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
							{PRODUCT_POSITIONING} OneGlanse submits prompts through the
							ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview
							interfaces, then sends captured response text to the model
							endpoint that you configure for analysis.
						</p>
					</header>

					<div className="space-y-10">
						<section aria-labelledby="collection-title">
							<h2 id="collection-title" className="text-2xl font-semibold">
								1. Collect from the product interface
							</h2>
							<p className="mt-3 text-base leading-7 text-muted-foreground">
								Provider collection uses browser automation to submit configured
								prompts and capture the rendered response and citations
								available in that interaction. It does not use the
								provider&apos;s model API for collection.
							</p>
						</section>

						<section aria-labelledby="analysis-title">
							<h2 id="analysis-title" className="text-2xl font-semibold">
								2. Analyze the captured response separately
							</h2>
							<p className="mt-3 text-base leading-7 text-muted-foreground">
								A separately configured OpenAI, Anthropic, or compatible model
								endpoint analyzes captured text. The resulting visibility, rank,
								sentiment, and recommendation fields are model-backed
								interpretations. They are not scores returned by the provider
								interface.
							</p>
						</section>

						<section aria-labelledby="interpret-title">
							<h2 id="interpret-title" className="text-2xl font-semibold">
								3. Interpret each result as a sample
							</h2>
							<p className="mt-3 text-base leading-7 text-muted-foreground">
								An answer is an observation from one prompt run, account,
								product interface, and point in time. Results can change with
								prompt wording, account state, location, product updates, and
								time. OneGlanse reports the captured sample; it does not claim
								that one run represents every user or every answer from that
								product.
							</p>
						</section>

						<section aria-labelledby="comparison-title">
							<h2 id="comparison-title" className="text-2xl font-semibold">
								A repeatable UI-versus-API comparison
							</h2>
							<p className="mt-3 text-base leading-7 text-muted-foreground">
								A product interface and an API are separate collection surfaces.
								To compare them, run the same prompt on both and record the
								conditions that could affect each result:
							</p>
							<ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-muted-foreground">
								{comparisonFields.map((field) => (
									<li key={field}>{field}</li>
								))}
							</ul>
							<p className="mt-4 text-base leading-7 text-muted-foreground">
								Repeat trials across prompts and dates. Compare answer text,
								brand mentions, recommendation order, and cited URLs as separate
								outcomes. Report the sample size and incomplete runs. Do not
								combine UI and API results into one metric unless the purpose
								and limitations of that combined metric are stated.
							</p>
						</section>

						<aside className="rounded-xl border border-border bg-muted/30 p-5">
							<h2 className="text-lg font-semibold">
								Related published comparison
							</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								A 2026 study by{" "}
								<a
									href="https://surferseo.com/blog/llm-scraped-ai-answers-vs-api-results/"
									className="text-foreground underline underline-offset-4"
									target="_blank"
									rel="noreferrer noopener"
								>
									Surfer
								</a>{" "}
								reports 21.3% to 31.6% overlap in canonicalized brand lists from
								a comparison of 1,000 prompts and 13,779 answers. The study used
								one sample per prompt and approximate model parity. These are
								study-specific findings, not a universal rate or a OneGlanse
								benchmark. OneGlanse does not currently publish its own measured
								cross-provider UI-versus-API benchmark.
							</p>
						</aside>

						<p className="text-sm leading-6 text-muted-foreground">
							For setup details, see the{" "}
							<a
								href={`${SITE_URLS.docs}introduction`}
								className="text-foreground underline underline-offset-4"
							>
								OneGlanse documentation
							</a>
							. The code and product behavior are available in the{" "}
							<a
								href={SITE_URLS.github}
								className="text-foreground underline underline-offset-4"
								target="_blank"
								rel="noreferrer noopener"
							>
								public repository
							</a>
							.
						</p>
					</div>
				</article>
			</main>
			<SiteFooter />
		</>
	);
}
