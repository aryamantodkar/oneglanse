import { Card } from "@oneglanse/ui";

type FaqItem = {
	question: string;
	answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
	{
		question: "What is OneGlanse?",
		answer:
			"OneGlanse is an open-source GEO (Generative Engine Optimization) and AI visibility tracking platform. It monitors how your brand appears inside real AI products — ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview — and produces scores for visibility, rank, sentiment, and recommendation strength.",
	},
	{
		question: "What is GEO (Generative Engine Optimization)?",
		answer:
			"GEO stands for Generative Engine Optimization. It is the practice of understanding and improving how your brand surfaces in AI-generated responses. As more users get answers directly from AI products instead of clicking search results, GEO measures whether you appear, where you rank, how you are framed, and whether the AI recommends you.",
	},
	{
		question: "How is OneGlanse different from API-based AI trackers?",
		answer:
			"Most GEO tools claim to track AI visibility by querying model APIs. OneGlanse opens the actual ChatGPT, Gemini, Perplexity, Claude, and AI Overview interfaces the same way a real user would. The UI layer adds inline citations, source cards, and recommendation ordering that never appear in raw API output. OneGlanse captures what users actually see, not what the API returns.",
	},
	{
		question: "Which AI providers does OneGlanse support?",
		answer:
			"OneGlanse supports ChatGPT (OpenAI), Google Gemini, Perplexity, Claude (Anthropic), and Google AI Overview. All five are monitored through their real web UIs using your own authenticated accounts.",
	},
	{
		question: "Is OneGlanse free?",
		answer:
			"Yes. OneGlanse is MIT licensed and free to run locally or on your own VPS. There is no subscription and no usage limit. You bring your own OpenAI or Anthropic API key for response analysis, and your own AI provider accounts for data collection.",
	},
	{
		question: "Does OneGlanse store my data in the cloud?",
		answer:
			"No. All data — responses, analytics, auth sessions, and scores — is stored in a PostgreSQL and ClickHouse instance you own and control, running locally or on your own VPS. Nothing passes through any third-party server. Analysis requests go directly from your machine to OpenAI or Anthropic.",
	},
	{
		question: "What is a GEO score?",
		answer:
			"A GEO score (0–100) is a weighted average of four equal components: Visibility (how prominently you surface), Rank (your absolute position in the response), Sentiment (how positively you are described), and Recommendation (whether the AI actively recommends you). Each component is scored separately so you can diagnose exactly where you are winning or losing.",
	},
	{
		question: "How do I get started with OneGlanse?",
		answer:
			"Clone the repository, copy .env.example to .env, set your OpenAI or Anthropic API key, and run pnpm local. The script starts Postgres, ClickHouse, Redis, runs migrations, and opens the app at localhost:3000. Go to /providers to connect your AI accounts, then add prompts and run. Full instructions are at docs.oneglanse.com.",
	},
];

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
		"@type": "Question",
		name: question,
		acceptedAnswer: {
			"@type": "Answer",
			text: answer,
		},
	})),
};

export function FaqSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="faq"
			aria-labelledby="faq-title"
		>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for search engines
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<Card className="landing-surface p-6">
				<h2
					id="faq-title"
					className="text-2xl font-semibold tracking-tight sm:text-3xl"
				>
					Frequently asked questions
				</h2>
				<p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
					Common questions about OneGlanse, GEO, and AI visibility tracking.
				</p>
				<dl className="mt-8 grid gap-6 sm:grid-cols-2">
					{FAQ_ITEMS.map(({ question, answer }) => (
						<div key={question} className="landing-muted-card px-4 py-4">
							<dt className="text-sm font-semibold leading-6">{question}</dt>
							<dd className="mt-2 text-sm leading-6 text-muted-foreground">
								{answer}
							</dd>
						</div>
					))}
				</dl>
			</Card>
		</section>
	);
}
