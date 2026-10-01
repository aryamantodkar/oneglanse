import { tools } from "./tools";

export type Comparison = {
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
			"Both tools are open source and support self-hosting. OneGlanse collects from five product interfaces. Elmo combines scraped and API targets with a REST API, CLI, and shareable reports.",
		otherStrength:
			"Elmo offers query fan-out, opportunity recommendations, and shareable reports. Its REST API and CLI support programmatic workflows.",
		oneglanseFit:
			"You want captured UI responses and model-backed analysis in your own stack, with collection code you can inspect.",
		otherFit:
			"API access, CLI setup, query fan-out, or shareable reporting are part of your workflow.",
		methodNote:
			"Both tools use product interfaces. Elmo also supports direct model APIs. Its README lists scraped products separately from API targets, so check the target behind each result. OneGlanse uses a model endpoint only for analysis after collection.",
	},
	{
		slug: "oneglanse-vs-profound",
		toolSlug: "profound",
		summary:
			"OneGlanse is self-hostable software for collecting your configured prompts. Profound is a commercial platform with broader Answer Engine Insights and content workflows.",
		otherStrength:
			"Profound documents citation share, regional analysis, sentiment, competitive views, and dedicated content and agent analytics. It suits teams that need a managed platform and wider organizational reporting.",
		oneglanseFit:
			"Control of the runtime and auditable product-interface collection are your main requirements.",
		otherFit:
			"Managed analytics, regional views, and connected optimization workflows justify a subscription.",
		methodNote:
			"Profound states that Answer Engine Insights uses headless browsers to query front-end interfaces. UI collection is therefore shared by both tools. Compare engine coverage, location, prompts, and scoring rules before equating their metrics.",
	},
	{
		slug: "oneglanse-vs-peec-ai",
		toolSlug: "peec-ai",
		summary:
			"OneGlanse gives you a self-hosted collection and analysis pipeline. Peec AI offers managed monitoring, location targeting, and client reporting.",
		otherStrength:
			"Peec offers daily tracking, location targeting, competitor views, and multi-client agency reporting. Exports and integrations help teams share results.",
		oneglanseFit:
			"You want to run and inspect the provider browser sessions and manage the captured data yourself.",
		otherFit:
			"You need agency reporting and managed daily checks without maintaining the application stack.",
		methodNote:
			"Peec documents UI scraping for most tracked engines and separate API targets, including OpenAI Search API. OneGlanse collects only through its five supported product interfaces. Compare the exact target, not just the provider name.",
	},
	{
		slug: "oneglanse-vs-otterly-ai",
		toolSlug: "otterly-ai",
		summary:
			"OneGlanse runs locally or on your server with your own accounts. Otterly AI sells managed daily monitoring with plan-based prompt and engine limits.",
		otherStrength:
			"Otterly AI documents daily tracking, team access, and higher-tier API and MCP access. Its pricing page states which engines are included and which require add-ons.",
		oneglanseFit:
			"You prefer an open codebase, control over sessions, and collection from the supported product interfaces.",
		otherFit:
			"Managed recurring checks and a ready-made team service are worth the subscription and plan limits.",
		methodNote:
			"Otterly states that it uses web scraping. Both tools therefore document product-interface collection. That does not make their samples equivalent: prompts, location, account state, and scoring can differ.",
	},
	{
		slug: "oneglanse-vs-promptwatch",
		toolSlug: "promptwatch",
		summary:
			"Both products collect answers through AI product interfaces. OneGlanse is an open, self-hostable tracker; Promptwatch combines tracking with crawler analytics and content workflows.",
		otherStrength:
			"Promptwatch documents prompt tracking, citation analysis, share of voice, AI crawler activity, and content agents. These go beyond OneGlanse's tracking and response analysis scope.",
		oneglanseFit:
			"You need inspectable browser collection and control over the runtime and captured responses.",
		otherFit:
			"Crawler telemetry and a connected content workflow matter more than self-hosting.",
		methodNote:
			"Promptwatch's data page explicitly describes collection from AI product interfaces. This is a shared method, not a unique OneGlanse feature. Compare the sampled products and context; UI collection alone does not prove coverage of all user experiences.",
	},
];

export function comparisonTool(comparison: Comparison) {
	return tools.find((tool) => tool.slug === comparison.toolSlug);
}
