import { tools } from "./tools";

type Comparison = {
	slug: string;
	toolSlug: string;
	summary: string;
	otherStrength: string;
	oneglanseFit: string;
	otherFit: string;
	methodNote: string;
};

export const comparisons: Comparison[] = [
	{
		slug: "oneglanse-vs-elmo",
		toolSlug: "elmo",
		summary:
			"Both are open source and can run on your own server. OneGlanse gets answers from five AI websites. Elmo also uses APIs and has a REST API, CLI, and shareable reports.",
		otherStrength:
			"Elmo has a REST API, CLI, shareable reports, query expansion, and recommendation features that OneGlanse does not currently have.",
		oneglanseFit:
			"You want to run everything yourself, see answers from the AI websites, and inspect the code doing the work.",
		otherFit: "You need its API, CLI, query expansion, or shareable reports.",
		methodNote:
			"Both open AI websites. Elmo also calls model APIs for some products. Check which method produced each result. OneGlanse calls a separate model only to analyze saved answers.",
	},
	{
		slug: "oneglanse-vs-profound",
		toolSlug: "profound",
		summary:
			"OneGlanse runs your prompts on your own machine or server. Profound is a managed service with broader reporting and content tools.",
		otherStrength:
			"Profound documents citation share, regional analysis, sentiment, competitive views, and dedicated content and agent analytics. It suits teams that need a managed platform and wider organizational reporting.",
		oneglanseFit:
			"You want to keep the app and saved answers on your own machine or server and inspect how it gets them.",
		otherFit: "You need managed analytics, regional views, and content tools.",
		methodNote:
			"Profound says it uses headless browsers to query AI websites. Both products use websites, but their prompts, locations, and scoring rules can differ.",
	},
	{
		slug: "oneglanse-vs-peec-ai",
		toolSlug: "peec-ai",
		summary:
			"OneGlanse runs on your own machine or server. Peec AI offers managed monitoring, location targeting, and client reports.",
		otherStrength:
			"Peec offers daily tracking, location targeting, competitor views, and multi-client agency reporting. Exports and integrations help teams share results.",
		oneglanseFit:
			"You want to control the browser sessions and keep the saved answers on your own server.",
		otherFit:
			"You need agency reports and daily checks without maintaining the app.",
		methodNote:
			"Peec says it opens websites for most tracked products and uses APIs for others, including OpenAI Search API. OneGlanse opens its five supported websites. Check the method for each product.",
	},
	{
		slug: "oneglanse-vs-otterly-ai",
		toolSlug: "otterly-ai",
		summary:
			"OneGlanse runs locally or on your server with your own accounts. Otterly AI sells managed daily monitoring with plan-based prompt and engine limits.",
		otherStrength:
			"Otterly AI documents daily tracking, team access, and higher-tier API and MCP access. Its pricing page states which engines are included and which require add-ons.",
		oneglanseFit:
			"You want open code, control over saved logins, and answers from the supported AI websites.",
		otherFit:
			"Managed recurring checks and a ready-made team service are worth the subscription and plan limits.",
		methodNote:
			"Otterly says it uses web scraping. Both products get answers from AI websites, but prompts, location, account, and scoring can differ.",
	},
	{
		slug: "oneglanse-vs-promptwatch",
		toolSlug: "promptwatch",
		summary:
			"Both get answers from AI websites. OneGlanse is open source and self-hosted; Promptwatch adds crawler analytics and content tools.",
		otherStrength:
			"Promptwatch documents prompt tracking, citation analysis, share of voice, AI crawler activity, and content agents. These go beyond OneGlanse's tracking and response analysis scope.",
		oneglanseFit:
			"You want to inspect the browser code and keep the app and answers on your own server.",
		otherFit:
			"You need crawler analytics and content tools in a managed service.",
		methodNote:
			"Promptwatch says it gets answers from AI websites. So does OneGlanse. Compare which products and prompts each tracks before comparing results.",
	},
];

export function comparisonTool(comparison: Comparison) {
	return tools.find((tool) => tool.slug === comparison.toolSlug);
}
