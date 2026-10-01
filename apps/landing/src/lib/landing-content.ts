import {
	Activity,
	Boxes,
	Database,
	Eye,
	GitBranch,
	KeyRound,
	Radar,
	SearchCheck,
	ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const PRODUCT_POSITIONING =
	"Free, open-source AI visibility tracking for marketing teams.";
export const PRODUCT_SUMMARY = `${PRODUCT_POSITIONING} Collect rendered answers and available citations from supported AI product interfaces, then analyze responses with a model endpoint you configure.`;
export const SITE_TITLE = "OneGlanse | Open-source AI Visibility & GEO Tracker";

export const SITE_URLS = {
	github: "https://github.com/oneglanse/oneglanse",
	githubLicense: "https://github.com/oneglanse/oneglanse/blob/main/LICENSE",
	signup: "https://oneglanse.com/signup",
	login: "https://oneglanse.com/login",
	docs: "https://docs.oneglanse.com/",
	homepage: "https://oneglanse.com",
	methodology: "https://oneglanse.com/methodology",
	sitemap: "https://oneglanse.com/sitemap.xml",
} as const;

export const SOCIAL_METADATA = {
	openGraph: {
		siteName: "OneGlanse",
		type: "website",
		images: [
			{
				url: "/social-preview.png",
				width: 1200,
				height: 630,
				alt: PRODUCT_POSITIONING,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		images: ["/social-preview.png"],
	},
} satisfies Pick<Metadata, "openGraph" | "twitter">;

type FeatureItem = {
	title: string;
	description: string;
	icon: LucideIcon;
};

export const FEATURE_ITEMS: FeatureItem[] = [
	{
		title: "Free to Run Locally",
		description:
			"Run OneGlanse without a subscription or usage fee. Provider plans, hosting, and model usage can cost extra.",
		icon: KeyRound,
	},
	{
		title: "Your Own Provider Accounts",
		description:
			"Use your own provider accounts. Sessions stay in your local runtime or on the self-hosted server you control.",
		icon: ShieldCheck,
	},
	{
		title: "AI Visibility Tracking",
		description: "Inspect mentions and recommendations in captured responses.",
		icon: Eye,
	},
	{
		title: "Response Analysis",
		description:
			"Compare mentions, rank, sentiment, recommendations, citations, and source domains in captured answers.",
		icon: Radar,
	},
	{
		title: "Multi-Provider Prompt Testing",
		description:
			"Run one prompt set across ChatGPT, Claude, Gemini, Perplexity, and AI Overview.",
		icon: SearchCheck,
	},
	{
		title: "Self-hostable Architecture",
		description:
			"Deploy the web app, worker, databases, and queue in infrastructure you control.",
		icon: Boxes,
	},
	{
		title: "ClickHouse Analytics",
		description:
			"Query captured responses, citations, and analysis data in ClickHouse.",
		icon: Database,
	},
	{
		title: "Open-source Transparency",
		description:
			"Read the code that collects provider responses and produces model-backed analysis.",
		icon: Activity,
	},
];

export const STORAGE_KEY = "oneglanse-landing-theme" as const;

export const METHOD_POINTS = [
	"Collection uses browser automation on the ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview interfaces. Provider collection does not use model APIs.",
	"Use your own provider accounts. Sessions stay on your local machine or, in self-host mode, are transferred to your own Agent server.",
	"After collection, captured response text is analyzed by the OpenAI, Anthropic, or compatible model endpoint you configure.",
	"A product interface and its provider API are different collection surfaces. Results can vary by account, location, prompt, and time.",
	"Visibility, rank, sentiment, and recommendation scores are model-backed interpretations of captured answers, not measurements from the AI products.",
] as const;

export const OPEN_SOURCE_POINTS: Array<{ text: string; icon: LucideIcon }> = [
	{
		text: "Run locally without a OneGlanse subscription. Provider plans, hosting, and model usage can cost extra.",
		icon: KeyRound,
	},
	{
		text: "Use your own provider accounts. Sessions stay in your local runtime or on the self-hosted server you control.",
		icon: ShieldCheck,
	},
	{
		text: "Fully open-source codebase with auditable commits and change history.",
		icon: GitBranch,
	},
	{
		text: "Self-hostable Docker stack for the web app, worker, queue, and data services.",
		icon: Boxes,
	},
	{
		text: "Store prompts, captured responses, citations, and analysis in your local or self-hosted app stack.",
		icon: Database,
	},
];

export const FOOTER_LINKS = [
	{ label: "Methodology", href: "/methodology" },
	{ label: "Docs", href: SITE_URLS.docs },
	{ label: "GitHub", href: SITE_URLS.github },
	{ label: "License", href: SITE_URLS.githubLicense },
] as const;
