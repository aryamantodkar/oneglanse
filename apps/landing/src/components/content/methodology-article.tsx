import { SITE_URLS } from "@/lib/landing-content";
import Link from "next/link";

const comparisonFields = [
	"Exact prompt text and any system or follow-up context",
	"Product interface or API, model/version when available, and run time",
	"Account state, language, location, and enabled search or grounding options",
	"Rendered answer text, named brands, recommendation order, and citation URLs",
	"Number of attempts, incomplete runs, and any exclusions",
];

export function MethodologyArticle(): React.JSX.Element {
	return (
		<article className="mx-auto max-w-4xl">
			<header className="mb-10">
				<h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
					How OneGlanse collects and analyzes AI answers
				</h1>
				<p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
					OneGlanse runs your prompts on ChatGPT, Perplexity, Gemini, Claude,
					and Google AI Overview. It saves the answers and citations shown on
					those websites. A separate model you connect analyzes the saved text.
				</p>
			</header>

			<div className="space-y-10">
				<section aria-labelledby="collection-title">
					<h2 id="collection-title" className="text-2xl font-semibold">
						1. Open the real website
					</h2>
					<p className="mt-3 text-base leading-7 text-muted-foreground">
						The Agent opens each website in a browser, runs your prompt, and
						saves the answer and citations it can find on the page. It does not
						call those products&apos; model APIs to get the answer.
					</p>
					<p className="mt-3 text-base leading-7 text-muted-foreground">
						The Agent uses Camoufox for that browser layer. Read{" "}
						<Link href="/why-camoufox" className="content-link">
							why OneGlanse moved from Chromium to Camoufox
						</Link>{" "}
						for the design history and its limits.
					</p>
				</section>

				<section aria-labelledby="analysis-title">
					<h2 id="analysis-title" className="text-2xl font-semibold">
						2. Analyze the answer afterward
					</h2>
					<p className="mt-3 text-base leading-7 text-muted-foreground">
						An OpenAI, Anthropic, or compatible model you connect analyzes the
						saved answer. It produces the visibility, rank, sentiment, and
						recommendation fields in the dashboard. The AI website does not
						provide those scores.
					</p>
				</section>

				<section aria-labelledby="interpret-title">
					<h2 id="interpret-title" className="text-2xl font-semibold">
						3. Don&apos;t treat one answer as universal
					</h2>
					<p className="mt-3 text-base leading-7 text-muted-foreground">
						One run is just one run. Change the prompt, account, location, or
						date and you may get a different answer. A saved answer does not
						tell you what every user will see.
					</p>
				</section>

				<section aria-labelledby="comparison-title">
					<h2 id="comparison-title" className="text-2xl font-semibold">
						Want to compare the website with the API?
					</h2>
					<p className="mt-3 text-base leading-7 text-muted-foreground">
						Run the same prompt on the website and API. Record the conditions
						that could affect each result:
					</p>
					<ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-muted-foreground">
						{comparisonFields.map((field) => (
							<li key={field}>{field}</li>
						))}
					</ul>
					<p className="mt-4 text-base leading-7 text-muted-foreground">
						Repeat trials across prompts and dates. Compare answer text, brand
						mentions, recommendation order, and cited URLs as separate outcomes.
						Report the sample size and incomplete runs. Do not combine UI and
						API results into one metric unless the purpose and limitations of
						that combined metric are stated.
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
						reports 21.3% to 31.6% overlap in canonicalized brand lists from a
						comparison of 1,000 prompts and 13,779 answers. The study used one
						sample per prompt and approximate model parity. These are
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
	);
}
