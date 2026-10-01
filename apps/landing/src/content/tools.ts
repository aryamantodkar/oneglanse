export type Tool = {
	slug: string;
	name: string;
	url: string;
	model: string;
	collection: string;
	openSource: boolean;
	selfHosted: boolean;
	summary: string;
	sources: string[];
};

// Public vendor documentation checked 2026-10-01. An undocumented collection
// method is left unknown; a product page is not evidence of a specific method.
export const verifiedAt = "2026-10-01";

export const tools: Tool[] = [
	{
		slug: "oneglanse",
		name: "OneGlanse",
		url: "https://oneglanse.com",
		model: "Free software; bring your own accounts and analysis key",
		collection: "Product interfaces",
		openSource: true,
		selfHosted: true,
		summary:
			"Captures rendered answers and citations from five product interfaces. A configured model endpoint analyzes the captured text afterward.",
		sources: [
			"https://github.com/oneglanse/oneglanse",
			"https://oneglanse.com/methodology",
		],
	},
	{
		slug: "elmo",
		name: "Elmo",
		url: "https://www.elmohq.com",
		model: "Open source; cloud option",
		collection: "Mixed methods documented",
		openSource: true,
		selfHosted: true,
		summary:
			"Tracks mentions, citations, competitors, and query fan-out. Its README documents reports, a REST API, and a CLI; collection varies by target.",
		sources: [
			"https://github.com/elmohq/elmo/blob/main/README.md",
			"https://github.com/elmohq/elmo/releases",
		],
	},
	{
		slug: "profound",
		name: "Profound",
		url: "https://www.tryprofound.com",
		model: "Subscription",
		collection: "Method varies by product; confirm with vendor",
		openSource: false,
		selfHosted: false,
		summary:
			"Answer Engine Insights measures brand visibility, citations, sentiment, and competitive performance; it also offers content and agent analytics.",
		sources: [
			"https://help.tryprofound.com/articles/3443229936-answer-engine-insights-overview",
			"https://www.tryprofound.com/features/answer-engine-insights/citations",
		],
	},
	{
		slug: "peec-ai",
		name: "Peec AI",
		url: "https://peec.ai",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Tracks prompt-level mentions, position, citations, and competitor visibility, with reporting for teams and agencies.",
		sources: [
			"https://peec.ai/product/ai-visibility",
			"https://peec.ai/for-agencies",
		],
	},
	{
		slug: "otterly-ai",
		name: "Otterly AI",
		url: "https://otterly.ai",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Runs recurring prompt checks and reports AI search visibility, citations, and competitor mentions. Engine access varies by plan.",
		sources: ["https://otterly.ai/", "https://otterly.ai/pricing"],
	},
	{
		slug: "promptwatch",
		name: "Promptwatch",
		url: "https://promptwatch.com",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Combines prompt tracking, citation analysis, share of voice, crawler analytics, and content workflows.",
		sources: ["https://promptwatch.com/"],
	},
	{
		slug: "ahrefs-brand-radar",
		name: "Ahrefs Brand Radar",
		url: "https://ahrefs.com/brand-radar",
		model: "Subscription",
		collection: "Platform-specific; Claude custom prompts use API",
		openSource: false,
		selfHosted: false,
		summary:
			"Searches a large index of AI answers and tracks custom prompts, brand mentions, citations, and share of voice.",
		sources: [
			"https://help.ahrefs.com/en/articles/11064852-what-is-brand-radar-and-how-to-use-it",
			"https://ahrefs.com/brand-radar",
		],
	},
	{
		slug: "semrush-ai-visibility",
		name: "Semrush AI Visibility Toolkit",
		url: "https://www.semrush.com/solutions/ai-visibility/",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Reports brand share of voice, sentiment, prompt visibility, and citations alongside Semrush search data.",
		sources: [
			"https://www.semrush.com/solutions/ai-visibility/",
			"https://www.semrush.com/kb/1496-getting-started-with-ai-visibility-toolkit",
		],
	},
	{
		slug: "rankscale",
		name: "Rankscale",
		url: "https://rankscale.ai",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Measures mentions, citations, and brand perception across generative answer products.",
		sources: ["https://rankscale.ai/media-kit", "https://rankscale.ai/"],
	},
	{
		slug: "scrunch",
		name: "Scrunch",
		url: "https://scrunch.com",
		model: "Subscription",
		collection: "Not stated in cited sources",
		openSource: false,
		selfHosted: false,
		summary:
			"Combines AI search visibility reporting with site and agent experience analysis.",
		sources: ["https://scrunch.com/"],
	},
];

export const categories = {
	"open-source": {
		title: "Open-source AI visibility tools",
		description:
			"Projects with public source code. Check the license and operating costs before deployment.",
		criteria: [
			"Inspect the collection code and the scoring rules separately. Open code lets you audit both; it does not make a captured answer representative of every user.",
			"Check the license, maintained releases, setup instructions, and costs for provider accounts, hosting, and analysis endpoints.",
		],
		matches: (tool: Tool) => tool.openSource,
	},
	"self-hosted": {
		title: "Self-hosted AI visibility tools",
		description:
			"Tools documented for deployment on infrastructure you control. Provider accounts and model calls may still use external services.",
		criteria: [
			"Trace where browser sessions, captured answers, and analysis requests go. Self-hosting the app does not mean no data reaches a model provider.",
			"Budget for the server, database, queue, provider plans, and model usage. Confirm backup and upgrade steps before an always-on deployment.",
		],
		matches: (tool: Tool) => tool.selfHosted,
	},
	"browser-based": {
		title: "AI visibility tools using product interfaces",
		description:
			"Collection surface changes what you measure. These projects document browser or product-interface collection; others may use mixed or undisclosed methods.",
		criteria: [
			"Only documented product-interface collection qualifies here. Elmo uses mixed targets; confirm the target behind each result. Undisclosed methods are omitted, not classified as API-based.",
			"Record prompt, account state, location, time, rendered answer, and citations. Compare the same surface across runs before drawing a trend.",
		],
		matches: (tool: Tool) =>
			tool.collection === "Product interfaces" ||
			tool.collection === "Mixed methods documented",
	},
} as const;
