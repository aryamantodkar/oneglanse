import type { Source } from "./sources";

export type Tool = {
	slug: string;
	name: string;
	url: string;
	model: string;
	collection: string;
	targets: string;
	collectionKind: "ui" | "mixed" | "undisclosed";
	openSource: boolean;
	selfHosted: boolean;
	summary: string;
	sources: Source[];
};

// Public vendor documentation checked 2026-10-01. An undocumented collection
// method is left unknown; a product page is not evidence of a specific method.
export const verifiedAt = "2026-10-01";

export const tools: Tool[] = [
	{
		slug: "oneglanse",
		name: "OneGlanse",
		url: "https://oneglanse.com",
		model: "Free software; use your own AI accounts and analysis model",
		collection: "AI websites",
		targets: "ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview.",
		collectionKind: "ui",
		openSource: true,
		selfHosted: true,
		summary:
			"Saves answers and citations from five AI websites. A model you connect scores visibility, rank, sentiment, and recommendations.",
		sources: [
			{
				label: "OneGlanse README",
				url: "https://github.com/oneglanse/oneglanse",
			},
			{
				label: "Collection methodology",
				url: "https://oneglanse.com/methodology",
			},
		],
	},
	{
		slug: "elmo",
		name: "Elmo",
		url: "https://www.elmohq.com",
		model: "Open-source software; cloud option",
		collection: "AI websites + APIs",
		targets:
			"UI: ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and AI Overviews. Direct APIs also cover Claude and other models.",
		collectionKind: "mixed",
		openSource: true,
		selfHosted: true,
		summary:
			"Tracks mentions, citations, competitors, and query fan-out. Includes shareable reports, a REST API, and a CLI.",
		sources: [
			{
				label: "Elmo README",
				url: "https://github.com/elmohq/elmo/blob/main/README.md",
			},
			{
				label: "Release notes",
				url: "https://github.com/elmohq/elmo/releases",
			},
		],
	},
	{
		slug: "profound",
		name: "Profound",
		url: "https://www.tryprofound.com",
		model: "Subscription",
		collection: "AI websites",
		targets:
			"Examples in Answer Engine Insights documentation: ChatGPT, Perplexity, and Gemini.",
		collectionKind: "ui",
		openSource: false,
		selfHosted: false,
		summary:
			"Answer Engine Insights measures brand visibility, citations, sentiment, and competitive performance; it also offers content and agent analytics.",
		sources: [
			{
				label: "Browser collection method",
				url: "https://www.tryprofound.com/articles/profound-vs-ahrefs",
			},
			{
				label: "Answer Engine Insights",
				url: "https://help.tryprofound.com/articles/3443229936-answer-engine-insights-overview",
			},
			{
				label: "Citation analytics",
				url: "https://www.tryprofound.com/features/answer-engine-insights/citations",
			},
		],
	},
	{
		slug: "peec-ai",
		name: "Peec AI",
		url: "https://peec.ai",
		model: "Subscription",
		collection: "AI websites + APIs",
		targets:
			"UI targets include ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and AI Overviews. Separate API targets are also available.",
		collectionKind: "mixed",
		openSource: false,
		selfHosted: false,
		summary:
			"Tracks visibility, position, sentiment, and citations. Offers agency reporting, location targeting, and integrations.",
		sources: [
			{
				label: "Collection methods and capabilities",
				url: "https://peec.ai/ai-instructions",
			},
			{
				label: "AI visibility monitoring",
				url: "https://peec.ai/product/ai-visibility",
			},
			{ label: "Agency reporting", url: "https://peec.ai/for-agencies" },
		],
	},
	{
		slug: "otterly-ai",
		name: "Otterly AI",
		url: "https://otterly.ai",
		model: "Subscription",
		collection: "Web scraping",
		targets:
			"ChatGPT, Perplexity, Copilot, and Google AI Overviews. Claude, Gemini, and Google AI Mode are listed as add-ons.",
		collectionKind: "ui",
		openSource: false,
		selfHosted: false,
		summary:
			"Runs recurring prompt checks and reports AI search visibility, citations, and competitor mentions. Engine access varies by plan.",
		sources: [
			{
				label: "Web scraping method",
				url: "https://otterly.ai/alternatives/otterly-vs-conductor/",
			},
			{ label: "Product overview", url: "https://otterly.ai/" },
			{ label: "Plans and engine coverage", url: "https://otterly.ai/pricing" },
		],
	},
	{
		slug: "promptwatch",
		name: "Promptwatch",
		url: "https://promptwatch.com",
		model: "Subscription",
		collection: "AI websites",
		targets:
			"Examples: ChatGPT, Perplexity, Gemini, Claude, and Google AI Overviews.",
		collectionKind: "ui",
		openSource: false,
		selfHosted: false,
		summary:
			"Combines prompt tracking, citation analysis, share of voice, crawler analytics, and content workflows.",
		sources: [
			{ label: "Data collection method", url: "https://promptwatch.com/data" },
			{ label: "Product overview", url: "https://promptwatch.com/" },
		],
	},
	{
		slug: "ahrefs-brand-radar",
		name: "Ahrefs Brand Radar",
		url: "https://ahrefs.com/brand-radar",
		model: "Subscription",
		collection: "AI websites; Claude custom prompts use API",
		targets:
			"Examples: ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews, and AI Mode. Index and custom-prompt coverage differ.",
		collectionKind: "mixed",
		openSource: false,
		selfHosted: false,
		summary:
			"Searches a large index of AI answers and tracks custom prompts, brand mentions, citations, and share of voice.",
		sources: [
			{
				label: "Brand Radar documentation",
				url: "https://help.ahrefs.com/en/articles/11064852-what-is-brand-radar-and-how-to-use-it",
			},
			{ label: "Product overview", url: "https://ahrefs.com/brand-radar" },
		],
	},
	{
		slug: "semrush-ai-visibility",
		name: "Semrush AI Visibility Toolkit",
		url: "https://www.semrush.com/solutions/ai-visibility/",
		model: "Subscription",
		collection: "Not stated in public docs",
		targets:
			"Examples: ChatGPT, Gemini, Perplexity, and Google AI. Custom-prompt coverage differs from brand reports.",
		collectionKind: "undisclosed",
		openSource: false,
		selfHosted: false,
		summary:
			"Reports brand share of voice, sentiment, prompt visibility, and citations alongside Semrush search data.",
		sources: [
			{
				label: "AI Visibility Toolkit",
				url: "https://www.semrush.com/solutions/ai-visibility/",
			},
			{
				label: "Getting started",
				url: "https://www.semrush.com/kb/1496-getting-started-with-ai-visibility-toolkit",
			},
		],
	},
	{
		slug: "rankscale",
		name: "Rankscale",
		url: "https://rankscale.ai",
		model: "Subscription",
		collection: "Not stated in public docs",
		targets:
			"Examples: ChatGPT, Perplexity, Gemini, Claude, Grok, Copilot, and Google AI Mode.",
		collectionKind: "undisclosed",
		openSource: false,
		selfHosted: false,
		summary:
			"Measures mentions, citations, and brand perception across generative answer products.",
		sources: [
			{ label: "Product facts", url: "https://rankscale.ai/media-kit" },
			{ label: "Product overview", url: "https://rankscale.ai/" },
		],
	},
	{
		slug: "scrunch",
		name: "Scrunch",
		url: "https://scrunch.com",
		model: "Subscription",
		collection: "Not stated in public docs",
		targets: "Examples: ChatGPT, Perplexity, Claude, Gemini, and Copilot.",
		collectionKind: "undisclosed",
		openSource: false,
		selfHosted: false,
		summary:
			"Combines AI search visibility reporting with site and agent experience analysis.",
		sources: [{ label: "Product overview", url: "https://scrunch.com/" }],
	},
];

export const categories = {
	"open-source": {
		title: "Open-source AI visibility tools",
		label: "Open source",
		description:
			"Open-source AI visibility tools whose code you can inspect and run yourself.",
		criteria: [
			"Read the code that gets answers and the code that scores them. Open code does not mean one answer represents every user.",
			"Check the license, recent releases, setup steps, and costs for AI accounts, hosting, and model APIs.",
		],
		matches: (tool: Tool) => tool.openSource,
	},
	"self-hosted": {
		title: "Self-hosted AI visibility tools",
		label: "Self-hosted",
		description:
			"AI visibility tools you can run on your own server. They may still call AI services or other APIs.",
		criteria: [
			"Check where saved logins, answers, and model requests go. Self-hosting does not mean your data stays offline.",
			"Budget for the server, database, queue, AI plans, and model usage. Check backup and upgrade steps before running it full time.",
		],
		matches: (tool: Tool) => tool.selfHosted,
	},
	"browser-based": {
		title: "AI visibility tools that use the real websites",
		label: "Real websites",
		description:
			"These products say they open AI websites instead of relying only on model APIs. Some use both methods.",
		criteria: [
			"Check how each AI product is queried. Some tools use websites for one product and APIs for another. Unknown methods are omitted.",
			"Record the prompt, account, location, time, answer, and citations. Compare like with like across runs.",
		],
		matches: (tool: Tool) =>
			tool.collectionKind === "ui" || tool.collectionKind === "mixed",
	},
} as const;
