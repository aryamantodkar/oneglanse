import {
	Boxes,
	Database,
	GitBranch,
	KeyRound,
	ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const PRODUCT_POSITIONING = "See how your brand shows up in AI answers.";
export const PRODUCT_SUMMARY = `${PRODUCT_POSITIONING} OneGlanse runs your prompts on ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview, saves the answers and citations, and analyzes them with a model you connect. Free and open source.`;
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

export const STORAGE_KEY = "oneglanse-landing-theme" as const;

export const OPEN_SOURCE_POINTS: Array<{ text: string; icon: LucideIcon }> = [
	{
		text: "Run locally without a OneGlanse subscription. AI accounts, hosting, and model API calls may still cost money.",
		icon: KeyRound,
	},
	{
		text: "Use your own AI accounts. Saved logins stay on your computer or the server you run.",
		icon: ShieldCheck,
	},
	{
		text: "Read the code that runs prompts, saves answers, and scores them.",
		icon: GitBranch,
	},
	{
		text: "Run the web app, agent, databases, and queue on your own server.",
		icon: Boxes,
	},
	{
		text: "Keep prompts, saved answers, citations, and analysis in your own app stack.",
		icon: Database,
	},
];

export const DISCOVERY_LINKS = [
	{
		label: "AI Tools",
		href: "/ai-visibility-tools",
		heading: "AI visibility tools",
		allLabel: "See all AI tools",
	},
	{
		label: "Compare",
		href: "/compare",
		heading: "Comparisons",
		allLabel: "See all comparisons",
	},
	{
		label: "Learn",
		href: "/guides",
		heading: "Learn",
		allLabel: "See all articles",
	},
] as const;

export const FOOTER_LINKS = [
	...DISCOVERY_LINKS,
	{ label: "Why Self-Hosted", href: "/why-self-hosted" },
	{ label: "Methodology", href: "/methodology" },
	{ label: "Docs", href: SITE_URLS.docs },
	{ label: "GitHub", href: SITE_URLS.github },
	{ label: "License", href: SITE_URLS.githubLicense },
] as const;
