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

const githubRepoUrl =
	process.env.NEXT_PUBLIC_GITHUB_REPO_URL?.trim() ||
	"https://github.com/aryamantodkar/oneglanse";

export const SITE_URLS = {
	github: githubRepoUrl,
	githubLicense: `${githubRepoUrl}/blob/main/LICENSE`,
	signup: "https://oneglanse.com/signup",
	login: "https://oneglanse.com/login",
	docs: "https://docs.oneglanse.com/",
	homepage: "https://oneglanse.com",
} as const;

type FeatureItem = {
	title: string;
	description: string;
	icon: LucideIcon;
};

export const FEATURE_ITEMS: FeatureItem[] = [
	{
		title: "Free to Run Locally",
		description:
			"Install once and run entirely on your own machine with no subscription, no usage limits.",
		icon: KeyRound,
	},
	{
		title: "Your Own Provider Accounts",
		description:
			"Log in to each AI provider with your own account. Sessions stay on your machine.",
		icon: ShieldCheck,
	},
	{
		title: "AI Visibility Tracking",
		description: "See where your brand appears and where it disappears.",
		icon: Eye,
	},
	{
		title: "GEO Monitoring",
		description: "Track recommendation strength, rank, and sentiment by model.",
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
		description: "Deploy web, worker, queue, and analytics in your own infra.",
		icon: Boxes,
	},
	{
		title: "ClickHouse Analytics",
		description:
			"Store high-volume responses and analytics with low-latency queries.",
		icon: Database,
	},
	{
		title: "Open-source Transparency",
		description: "Audit every step from prompt execution to final metric.",
		icon: Activity,
	},
];

export const STORAGE_KEY = "oneglanse-landing-theme" as const;

export const METHOD_POINTS = [
	"All five providers are monitored through their real web UIs: ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview. They are not monitored through model APIs.",
	"You log in to each provider with your own account. Sessions are stored locally on your machine and never leave your infrastructure.",
	"Captured responses are analyzed using your own OpenAI or Anthropic API key. No data passes through any third-party server.",
	"UI responses can differ from API responses in ranking, wording, and citation behavior for the same prompt.",
	"Most GEO vendors do not disclose collection methods, refresh cadence, or model provenance details.",
] as const;

export const OPEN_SOURCE_POINTS: Array<{ text: string; icon: LucideIcon }> = [
	{
		text: "Free to run locally with no subscription, no API calls to third-party servers.",
		icon: KeyRound,
	},
	{
		text: "Use your own provider accounts. Sessions live on your machine, never elsewhere.",
		icon: ShieldCheck,
	},
	{
		text: "Fully open-source codebase with auditable commits and change history.",
		icon: GitBranch,
	},
	{
		text: "Self-hostable Docker stack for web, worker, queue, and analytics.",
		icon: Boxes,
	},
	{
		text: "Full data ownership for prompts, responses, citations, and analytics.",
		icon: Database,
	},
];

export const FOOTER_LINKS = [
	{ label: "Docs", href: SITE_URLS.docs },
	{ label: "GitHub", href: SITE_URLS.github },
	{ label: "License", href: SITE_URLS.githubLicense },
] as const;
