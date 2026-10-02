import { BrandLogo } from "@/components/common/brand-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { comparisonTool, comparisons } from "@/content/comparisons";
import { guides } from "@/content/guides";
import { categories } from "@/content/tools";
import { DISCOVERY_LINKS, SITE_URLS } from "@/lib/landing-content";
import { Button } from "@oneglanse/ui";
import { BookOpen, GitFork, Github, Star } from "lucide-react";
import Link from "next/link";
import { DiscoveryNav } from "./discovery-nav";

type GitHubRepositoryStats = {
	stars: number;
	forks: number;
};

const discoveryItems: Record<
	(typeof DISCOVERY_LINKS)[number]["href"],
	Array<{ label: string; href: string }>
> = {
	"/ai-visibility-tools": Object.entries(categories).map(
		([slug, category]) => ({
			label: category.label,
			href: `/ai-visibility-tools/${slug}`,
		}),
	),
	"/compare": comparisons.map((comparison) => ({
		label: `OneGlanse vs ${comparisonTool(comparison)?.name ?? comparison.toolSlug}`,
		href: `/compare/${comparison.slug}`,
	})),
	"/guides": guides.map((guide) => ({
		label: guide.title,
		href: `/guides/${guide.slug}`,
	})),
};

const discoveryMenus = DISCOVERY_LINKS.map((link) => ({
	...link,
	items: [
		{ label: link.allLabel, href: link.href },
		...discoveryItems[link.href],
	],
}));

async function getGitHubRepositoryStats(): Promise<GitHubRepositoryStats | null> {
	try {
		const repositoryPath = new URL(SITE_URLS.github).pathname
			.replace(/\.git\/?$/, "")
			.replace(/\/$/, "");
		const repositorySegments = repositoryPath.split("/").filter(Boolean);

		if (repositorySegments.length !== 2) {
			return null;
		}

		const owner = repositorySegments[0];
		const repository = repositorySegments[1];

		if (!owner || !repository) {
			return null;
		}

		const response = await fetch(
			`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				next: { revalidate: 300 },
			},
		);

		if (!response.ok) {
			return null;
		}

		const data: unknown = await response.json();

		if (typeof data !== "object" || data === null) {
			return null;
		}

		const stats = data as Record<string, unknown>;

		if (
			typeof stats.stargazers_count !== "number" ||
			typeof stats.forks_count !== "number"
		) {
			return null;
		}

		return {
			stars: stats.stargazers_count,
			forks: stats.forks_count,
		};
	} catch {
		return null;
	}
}

export async function SiteHeader(): Promise<React.JSX.Element> {
	const repositoryStats = await getGitHubRepositoryStats();
	const formatCount = (count: number): string =>
		new Intl.NumberFormat("en").format(count);

	return (
		<header className="section-shell sticky top-0 z-40 pt-4 sm:pt-5">
			<div className="landing-surface grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-5 lg:grid-cols-[auto_1fr_auto] lg:gap-x-7">
				<Link
					href="/"
					className="inline-flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight sm:text-lg"
				>
					<BrandLogo alt="" className="h-6 w-6 shrink-0" />
					OneGlanse
				</Link>
				<DiscoveryNav menus={discoveryMenus} />

				<div className="col-start-2 row-start-1 flex shrink-0 items-center justify-self-end gap-2 lg:col-start-3">
					<Button
						asChild
						variant="outline"
						className="h-9 gap-1.5 border-amber-300/60 bg-gradient-to-b from-amber-100/65 to-amber-200/55 px-2.5 text-amber-900 shadow-[0_6px_16px_-12px_rgba(245,158,11,0.4)] hover:border-amber-400/70 hover:from-amber-100/80 hover:to-amber-200/70 hover:text-amber-950 hover:shadow-[0_8px_18px_-12px_rgba(245,158,11,0.5)] dark:border-amber-300/30 dark:from-amber-300/20 dark:to-amber-500/15 dark:text-amber-100 dark:shadow-[0_8px_20px_-10px_rgba(245,158,11,0.32)] dark:hover:border-amber-200/50 dark:hover:from-amber-300/25 dark:hover:to-amber-500/20 dark:hover:text-amber-50"
					>
						<a
							href={SITE_URLS.github}
							target="_blank"
							rel="noreferrer noopener"
							aria-label={
								repositoryStats
									? `GitHub repository: ${formatCount(repositoryStats.stars)} stars and ${formatCount(repositoryStats.forks)} forks`
									: "View OneGlanse on GitHub"
							}
						>
							<Github className="h-4 w-4" aria-hidden="true" />
							<span className="hidden sm:inline">GitHub</span>
							{repositoryStats && (
								<span className="hidden items-center gap-1.5 border-l border-amber-800/20 pl-1.5 text-xs font-semibold tabular-nums dark:border-amber-100/20 min-[360px]:inline-flex">
									<span className="inline-flex items-center gap-1">
										<Star
											className="h-3.5 w-3.5 fill-current"
											aria-hidden="true"
										/>
										{formatCount(repositoryStats.stars)}
									</span>
									<span className="hidden items-center gap-1 sm:inline-flex">
										<GitFork className="h-3.5 w-3.5" aria-hidden="true" />
										{formatCount(repositoryStats.forks)}
									</span>
								</span>
							)}
						</a>
					</Button>
					<Button
						asChild
						variant="outline"
						className="w-9 px-0 sm:w-auto sm:px-4"
					>
						<a
							href={SITE_URLS.docs}
							target="_blank"
							rel="noreferrer noopener"
							aria-label="Docs"
						>
							<BookOpen className="h-4 w-4" aria-hidden="true" />
							<span className="hidden sm:inline">Docs</span>
						</a>
					</Button>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
