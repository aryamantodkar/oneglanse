import { Card } from "@oneglanse/ui";

type FaqItem = {
	question: string;
	answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
	{
		question: "Is OneGlanse free?",
		answer:
			"Yes. The code is MIT licensed, and OneGlanse has no subscription fee. AI product plans, model API calls, hosting, and proxies may still cost money.",
	},
	{
		question: "Why use the websites instead of model APIs?",
		answer:
			"The websites can search the web, choose sources, add citations, and present answers differently from their model APIs. OneGlanse saves what the website actually shows, then uses a separate model you connect for analysis.",
	},
	{
		question: "Where does my data go?",
		answer:
			"The app stores prompts, answers, and scores on your computer or your self-hosted server. It sends prompts to the AI websites you choose and answer text to the analysis model you connect. The app also sends limited, hashed usage events to PostHog.",
	},
	{
		question: "Can I run it on my own server?",
		answer:
			"Yes. Run it locally on your computer or use Docker Compose on your own server. For a VPS, you will also need suitable proxy access and your own AI product accounts.",
	},
	{
		question: "Which AI products work?",
		answer:
			"OneGlanse works with ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview. It uses your own accounts to run prompts on their websites.",
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
					Questions people ask
				</h2>
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
