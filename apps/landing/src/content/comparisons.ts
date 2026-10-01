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
			"Both projects publish source code and support self-hosting. OneGlanse limits provider collection to five browser-driven product interfaces; Elmo documents a broader workflow with reports, a REST API, a CLI, and target-specific collection.",
		otherStrength:
			"Elmo documents query fan-out, opportunity recommendations, shareable reports, a CLI, and a REST API. Those are concrete advantages when you need a programmatic or wider reporting workflow.",
		oneglanseFit:
			"Choose OneGlanse when your main question is what the five supported product interfaces rendered for a prompt and you want to inspect the captured response and citations in your own stack.",
		otherFit:
			"Choose Elmo when API access, CLI setup, query fan-out, or shareable reporting matters more than a single documented collection surface.",
		methodNote:
			"Elmo release notes describe both scraping and direct-API targets. Compare the collection target for each engine before treating two metrics as equivalent.",
	},
	{
		slug: "oneglanse-vs-profound",
		toolSlug: "profound",
		summary:
			"OneGlanse is self-hostable software for collecting your configured prompts. Profound is a commercial platform with broader Answer Engine Insights and content workflows.",
		otherStrength:
			"Profound documents citation share, regional analysis, sentiment, competitive views, and dedicated content and agent analytics. It suits teams that need a managed platform and wider organizational reporting.",
		oneglanseFit:
			"Choose OneGlanse when control of the runtime and auditable product-interface collection are your main requirements.",
		otherFit:
			"Choose Profound when managed analytics, regional views, and connected optimization workflows justify a subscription.",
		methodNote:
			"Profound documents its outputs but does not establish one collection method for every product in the sources cited here. Ask for the method behind the surfaces you will compare.",
	},
	{
		slug: "oneglanse-vs-peec-ai",
		toolSlug: "peec-ai",
		summary:
			"OneGlanse exposes a self-hosted collection and analysis pipeline. Peec AI packages AI visibility monitoring and client reporting as a subscription service.",
		otherStrength:
			"Peec documents daily prompt tracking, citation counts, competitor gaps, and agency reporting. Its managed workflow reduces setup work for a marketing team.",
		oneglanseFit:
			"Choose OneGlanse if you want to run and inspect the provider browser sessions and manage the captured data yourself.",
		otherFit:
			"Choose Peec AI if you need agency reporting and managed daily checks without maintaining the application stack.",
		methodNote:
			"Peec's cited pages do not specify a universal UI-versus-API collection method. Confirm its method for each product if that distinction matters to your study.",
	},
	{
		slug: "oneglanse-vs-otterly-ai",
		toolSlug: "otterly-ai",
		summary:
			"OneGlanse runs locally or on your server with your own accounts. Otterly AI sells managed daily monitoring with plan-based prompt and engine limits.",
		otherStrength:
			"Otterly AI documents daily tracking, team access, and higher-tier API and MCP access. Its pricing page states which engines are included and which require add-ons.",
		oneglanseFit:
			"Choose OneGlanse when you prefer an open codebase, control over sessions, and collection from the supported product interfaces.",
		otherFit:
			"Choose Otterly AI when managed recurring checks and a ready-made team service are worth the subscription and plan limits.",
		methodNote:
			"Otterly's cited pages describe monitoring and coverage, not a single collection method across all engines. Compare an actual sample before equating scores.",
	},
	{
		slug: "oneglanse-vs-promptwatch",
		toolSlug: "promptwatch",
		summary:
			"Both products track brand appearances in AI answers. OneGlanse is an open, self-hostable tracker; Promptwatch combines tracking with crawler analytics and content workflows.",
		otherStrength:
			"Promptwatch documents prompt tracking, citation analysis, share of voice, AI crawler activity, and content agents. These go beyond OneGlanse's tracking and response analysis scope.",
		oneglanseFit:
			"Choose OneGlanse when you need inspectable browser collection and control over the runtime and captured responses.",
		otherFit:
			"Choose Promptwatch when crawler telemetry and a connected content workflow matter more than self-hosting.",
		methodNote:
			"Promptwatch's public page says it tracks real prompts and responses. It does not establish browser-UI collection for every provider, so this comparison does not claim methodological parity.",
	},
];

export function comparisonTool(comparison: Comparison) {
	return tools.find((tool) => tool.slug === comparison.toolSlug);
}
