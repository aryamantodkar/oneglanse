import { PRODUCT_POSITIONING } from "@/lib/landing-content";
import { Card } from "@oneglanse/ui";

type FaqItem = {
	question: string;
	answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
	{
		question: "What is OneGlanse?",
		answer: `${PRODUCT_POSITIONING} It runs prompts through the ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview interfaces, extracts rendered responses and citations, then analyzes the captured text with a model endpoint you configure.`,
	},
	{
		question: "What is GEO (Generative Engine Optimization)?",
		answer:
			"GEO stands for Generative Engine Optimization. It is the practice of understanding and improving how a brand appears in AI-generated responses. OneGlanse records sampled responses from AI product interfaces so teams can inspect mentions, rank, sentiment, citations, and recommendations.",
	},
	{
		question: "How is OneGlanse different from API-based AI trackers?",
		answer:
			"OneGlanse uses browser automation to submit prompts to the AI product interfaces and extract their rendered responses and citations. Provider collection does not use model APIs. Product interfaces and their provider APIs can return different wording, ordering, and citations. Analysis happens afterward through the model endpoint you configure.",
	},
	{
		question: "Which AI providers does OneGlanse support?",
		answer:
			"OneGlanse supports ChatGPT (OpenAI), Google Gemini, Perplexity, Claude (Anthropic), and Google AI Overview. Collection uses browser automation on their user-facing interfaces.",
	},
	{
		question: "Is OneGlanse free?",
		answer:
			"Yes. OneGlanse is MIT licensed and has no subscription or usage fee. Provider plans, model API usage, hosting, and proxy service can cost extra. You use your own AI product accounts for collection and configure the endpoint and key for response analysis.",
	},
	{
		question: "Where does OneGlanse store prompts and responses?",
		answer:
			"In local mode, app data is stored in the stack running on your machine. In self-host mode, it is stored in the services you deploy. Prompts are submitted to the selected AI product interfaces, and captured response text is sent to the analysis model endpoint you configure. In self-host mode, you transfer provider sessions to your own Agent server.",
	},
	{
		question: "What analytics does OneGlanse use?",
		answer:
			"The landing site uses Vercel Analytics. The app sends user_signed_up and user_active events to PostHog. Each app event includes a SHA-256 hash of the internal user ID, not prompts, captured responses, scores, names, or email addresses.",
	},
	{
		question: "What is a GEO score?",
		answer:
			"OneGlanse asks the configured analysis model to estimate visibility, rank, sentiment, and recommendation strength from each captured response. The overall score combines those components. These are model-backed interpretations of sampled text, not official measurements from the AI products.",
	},
	{
		question: "How do I get started with OneGlanse?",
		answer:
			"Follow the local setup guide to start the app, connect supported AI product accounts, configure a model endpoint for analysis, and run your first prompts. The guide is at docs.oneglanse.com/local-setup.",
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
