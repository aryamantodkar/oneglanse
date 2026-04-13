import {
	Activity,
	Boxes,
	Database,
	Eye,
	GitBranch,
	Globe,
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
	app: "https://app.oneglanse.com",
	homepage: "https://oneglanse.com",
} as const;

export type FeatureItem = {
	title: string;
	description: string;
	icon: LucideIcon;
};

export const FEATURE_ITEMS: FeatureItem[] = [
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
			"Run one prompt set across ChatGPT, Claude, Gemini, and Perplexity.",
		icon: SearchCheck,
	},
	{
		title: "Self-hostable Architecture",
		description: "Deploy web, worker, queue, and analytics in your own infra.",
		icon: Boxes,
	},
	{
		title: "Proxy-aware Scraping",
		description:
			"Use isolated workers with proxy scoring, retries, and cooldown control.",
		icon: Globe,
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

export const ARCHITECTURE_NODES = [
	{
		title: "Web App",
		description:
			"Authenticated dashboard for workspace setup, prompts, schedules, and metrics.",
	},
	{
		title: "Agent Worker",
		description:
			"Playwright-based provider workers process prompt queues and capture responses.",
	},
	{
		title: "Redis",
		description:
			"BullMQ queue backbone for per-provider job orchestration and progress tracking.",
	},
	{
		title: "ClickHouse",
		description:
			"Analytics store for prompt responses, sources, and computed GEO insights.",
	},
	{
		title: "Docker Deployment",
		description:
			"Compose-based separation for web, agent, data stores, and runtime environment.",
	},
] as const;

export const STORAGE_KEY = "oneglanse-landing-theme" as const;

export const METHOD_POINTS = [
	"OneGlanse captures model web UI outputs through logged-out sessions for real user-view results.",
	"Scraping runs through residential proxies to reduce geo bias and improve coverage stability.",
	"Claude is excluded from UI scraping and is integrated through the official Claude API only.",
	"UI answers and API answers can differ in ranking, wording, and citation behavior for the same prompt.",
	"Most GEO vendors do not disclose collection methods, refresh cadence, or model provenance details.",
] as const;

export const OPEN_SOURCE_POINTS: Array<{ text: string; icon: LucideIcon }> = [
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
	{
		text: "Transparent provider integrations with no vendor lock-in.",
		icon: KeyRound,
	},
	{
		text: "Traceable pipeline from prompt execution to final scored metrics.",
		icon: ShieldCheck,
	},
];

export const FOOTER_LINKS = [
	{ label: "Docs", href: SITE_URLS.docs },
	{ label: "GitHub", href: SITE_URLS.github },
	{ label: "App", href: SITE_URLS.app },
	{ label: "License", href: SITE_URLS.githubLicense },
] as const;
