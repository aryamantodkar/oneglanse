"use client";

import { ExportMenu } from "@/components/export-menu";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import type { GroupedSource, SourceGroupResult } from "@oneglanse/types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@oneglanse/ui";
import {
	getDomain,
	getFaviconUrls,
	getModelFavicon,
	modelSelectors,
} from "@oneglanse/utils";
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BarChart3,
	Bot,
	ChevronRight,
	ExternalLink,
	Globe2,
	Link2,
	SearchX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { usePromptSources } from "../prompts/_lib/queries/prompt.queries";

type DomainGroup = {
	domain: string;
	totalCitations: number;
	urlCount: number;
	providers: Set<string>;
	urls: GroupedSource[];
};

type SortColumn = "share" | "citations" | "urls" | null;
type SortDirection = "asc" | "desc";

function formatCitationLabel(count: number): string {
	return `${count} citation${count === 1 ? "" : "s"}`;
}

function getUrlPath(url: string): string {
	try {
		const parsed = new URL(url);
		const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
		return path && path !== "/" ? path : "/";
	} catch {
		return "/";
	}
}

function cleanCitedText(text: string): string {
	return text.replace(/\s*(?:\.\.\.|…)?\s*read more\.?\s*$/i, "").trim();
}

function SortableHeader({
	children,
	column,
	currentSort,
	currentDirection,
	onSort,
}: {
	children: React.ReactNode;
	column: SortColumn;
	currentSort: SortColumn;
	currentDirection: SortDirection;
	onSort: (column: SortColumn) => void;
}) {
	const isActive = currentSort === column;

	return (
		<button
			onClick={() => onSort(column)}
			className="flex items-center gap-1 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
		>
			{children}
			{isActive ? (
				currentDirection === "asc" ? (
					<ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
				) : (
					<ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
				)
			) : (
				<ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
			)}
		</button>
	);
}

function FaviconWithFallback({
	url,
	size = "md",
}: { url: string; size?: "sm" | "md" }) {
	const [showFavicon, setShowFavicon] = useState(true);
	const favicon = getFaviconUrls(url, "")[0];

	const sizeClasses = size === "sm" ? "h-4 w-4" : "h-5 w-5";
	const iconSizeClasses = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

	if (favicon && showFavicon) {
		return (
			<img
				src={favicon}
				alt=""
				className={`${sizeClasses} rounded-sm`}
				onError={() => setShowFavicon(false)}
			/>
		);
	}

	return (
		<div
			className={`${sizeClasses} flex items-center justify-center rounded-sm bg-gray-100 dark:bg-gray-800`}
		>
			<Globe2
				className={`${iconSizeClasses} text-gray-500 dark:text-gray-400`}
			/>
		</div>
	);
}

function MetricCard({
	label,
	value,
	subtitle,
	icon: Icon,
	badgeFavicon,
}: {
	label: string;
	value: string;
	subtitle: string;
	icon: typeof Globe2;
	badgeFavicon?: string | null;
}) {
	return (
		<div className="ui-list-item rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
			<div className="flex items-center gap-2">
				<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					{label}
				</span>
			</div>
			<p className="mt-3 text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
				{value}
			</p>
			<div className="mt-2 flex items-center gap-2">
				{badgeFavicon && (
					<img
						src={badgeFavicon}
						alt=""
						className="h-3.5 w-3.5 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				)}
				<p className="text-xs text-muted-foreground">{subtitle}</p>
			</div>
		</div>
	);
}

export default function SourcesPage(): React.JSX.Element {
	const [selectedProvider, setSelectedProvider] =
		useState<string>("All Models");
	const [activeTab, setActiveTab] = useState<"domains" | "citations">(
		"domains",
	);
	const [openDomain, setOpenDomain] = useState<string | null>(null);
	const [openUrl, setOpenUrl] = useState<string | null>(null);

	// Sorting state
	const [sortColumn, setSortColumn] = useState<SortColumn>("citations");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const {
		data: promptSources,
		isLoading,
		error,
	} = usePromptSources(workspaceId);

	const sourceStats = useMemo<SourceGroupResult | null>(() => {
		const data = promptSources;
		if (
			!data ||
			!data.sourceStats ||
			!Array.isArray(data.sourceStats.combined)
		) {
			return null;
		}
		return data.sourceStats as SourceGroupResult;
	}, [promptSources]);

	const displayedSources = useMemo<GroupedSource[]>(() => {
		if (!sourceStats) return [];
		const rows =
			selectedProvider === "All Models"
				? sourceStats.combined
				: (sourceStats.byModel[selectedProvider] ?? []);
		return [...rows].sort(
			(a, b) => (b.totalSources ?? 0) - (a.totalSources ?? 0),
		);
	}, [sourceStats, selectedProvider]);

	const domainGroups = useMemo<DomainGroup[]>(() => {
		const map = new Map<string, DomainGroup>();

		for (const source of displayedSources) {
			const domain = getDomain(source.url) || "unknown";
			const existing = map.get(domain) ?? {
				domain,
				totalCitations: 0,
				urlCount: 0,
				providers: new Set<string>(),
				urls: [],
			};

			existing.totalCitations += source.totalSources ?? 0;
			existing.urlCount += 1;
			for (const excerpt of source.excerpts) {
				if (excerpt.model_provider) {
					existing.providers.add(excerpt.model_provider);
				}
			}
			existing.urls.push(source);

			map.set(domain, existing);
		}

		return [...map.values()];
	}, [displayedSources]);

	// Sorted domain groups based on sort column and direction
	const sortedDomainGroups = useMemo<DomainGroup[]>(() => {
		const totalCitations = domainGroups.reduce(
			(sum, d) => sum + d.totalCitations,
			0,
		);

		return [...domainGroups].sort((a, b) => {
			let aValue: number;
			let bValue: number;

			if (sortColumn === "share") {
				aValue =
					totalCitations > 0 ? (a.totalCitations / totalCitations) * 100 : 0;
				bValue =
					totalCitations > 0 ? (b.totalCitations / totalCitations) * 100 : 0;
			} else if (sortColumn === "citations") {
				aValue = a.totalCitations;
				bValue = b.totalCitations;
			} else if (sortColumn === "urls") {
				aValue = a.urlCount;
				bValue = b.urlCount;
			} else {
				// Default sort by citations descending
				return b.totalCitations - a.totalCitations;
			}

			const compareResult = aValue - bValue;
			return sortDirection === "asc" ? compareResult : -compareResult;
		});
	}, [domainGroups, sortColumn, sortDirection]);

	const handleSort = (column: SortColumn) => {
		if (sortColumn === column) {
			// Toggle direction if same column
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			// New column, default to descending
			setSortColumn(column);
			setSortDirection("desc");
		}
	};

	const aggregate = useMemo(() => {
		const totalUrls = displayedSources.length;
		const totalDomains = domainGroups.length;
		const totalCitations = displayedSources.reduce(
			(sum, s) => sum + (s.totalSources ?? 0),
			0,
		);
		const avgCitationsPerUrl = totalUrls
			? (totalCitations / totalUrls).toFixed(1)
			: "0.0";
		const topDomainCitations = domainGroups[0]?.totalCitations ?? 0;
		const topDomainShare = totalCitations
			? Math.round((topDomainCitations / totalCitations) * 100)
			: 0;

		return {
			totalUrls,
			totalDomains,
			totalCitations,
			avgCitationsPerUrl,
			topDomainShare,
			topDomain: domainGroups[0]?.domain ?? "N/A",
		};
	}, [displayedSources, domainGroups]);

	if (!workspaceId) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center px-6 text-center">
					<div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
						<SearchX className="h-5 w-5 text-gray-400 dark:text-gray-500" />
					</div>
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Select a workspace
					</h2>
					<p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
						Choose a workspace from the sidebar to view source intelligence.
					</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="min-h-screen p-6">
				<div className="space-y-4">
					<Skeleton className="h-10 w-56" />
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton
								key={`sources-metric-${i}`}
								className="h-28 rounded-2xl"
							/>
						))}
					</div>
					<Skeleton className="h-[480px] rounded-2xl" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
					<AlertTriangle className="h-5 w-5 text-amber-500" />
				</div>
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Unable to load sources
				</h2>
				<p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
					We ran into an issue loading your source data. Please try again in a
					moment.
				</p>
			</div>
		);
	}

	if (!sourceStats) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
				<p className="text-lg text-gray-500 dark:text-gray-400">
					No prompt responses yet.
				</p>
				<p className="mt-2 text-sm text-gray-400">
					If you&apos;ve just run prompts, please check back in a few minutes.
				</p>
			</div>
		);
	}

	const hasData = displayedSources.length > 0;

	return (
		<div className="ui-page-enter min-h-screen p-4 sm:p-6 lg:p-8">
			<div className="ui-stagger mx-auto w-full max-w-[95vw] space-y-6 xl:max-w-[1600px]">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
							Sources Intelligence
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							High-signal view of where model answers are sourced from.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<ExportMenu
							disabled={!hasData}
							onExportJson={() => {
								const citationRows = domainGroups.flatMap((group) =>
									group.urls.flatMap((source) =>
										(source.excerpts ?? []).map((excerpt) => ({
											domain: group.domain,
											url: source.url,
											title: source.title,
											urlPath: getUrlPath(source.url),
											totalCitations: source.totalSources ?? 0,
											modelProvider: excerpt.model_provider ?? "",
											citedText: excerpt.cited_text
												? cleanCitedText(excerpt.cited_text)
												: "",
										})),
									),
								);
								const topDomains = domainGroups.slice(0, 10).map((group) => ({
									domain: group.domain,
									totalCitations: group.totalCitations,
									share:
										aggregate.totalCitations > 0
											? Number(
													(
														(group.totalCitations / aggregate.totalCitations) *
														100
													).toFixed(1),
												)
											: 0,
									urlCount: group.urlCount,
								}));
								const concentrationRisk =
									aggregate.topDomainShare >= 45
										? "high"
										: aggregate.topDomainShare >= 30
											? "moderate"
											: "healthy";

								downloadJson(`sources-${workspaceId}-${Date.now()}.json`, {
									generatedAt: new Date().toISOString(),
									workspaceId,
									report: {
										title: "Sources Intelligence Export",
										version: "2.0",
										filters: {
											selectedProvider,
											activeTab,
										},
									},
									overview: {
										totalDomains: aggregate.totalDomains,
										totalUrls: aggregate.totalUrls,
										totalCitations: aggregate.totalCitations,
										avgCitationsPerUrl: aggregate.avgCitationsPerUrl,
									},
									impactSummary: {
										topDomain: aggregate.topDomain,
										topDomainShare: `${aggregate.topDomainShare}%`,
										sourceConcentrationRisk: concentrationRisk,
									},
									leaderboards: {
										topDomains,
									},
									detailedData: {
										aggregate,
										domainGroups: domainGroups.map((group) => ({
											domain: group.domain,
											totalCitations: group.totalCitations,
											urlCount: group.urlCount,
											providers: Array.from(group.providers),
										})),
										sources: displayedSources,
										citations: citationRows,
									},
								});
							}}
							onExportCsv={() => {
								const rows = [
									{
										section: "overview",
										metric: "Domains",
										value: aggregate.totalDomains,
									},
									{
										section: "overview",
										metric: "URLs",
										value: aggregate.totalUrls,
									},
									{
										section: "overview",
										metric: "Citations",
										value: aggregate.totalCitations,
									},
									{
										section: "overview",
										metric: "Top Domain Share",
										value: `${aggregate.topDomainShare}%`,
									},
									...domainGroups.map((group) => ({
										section: "domain_performance",
										domain: group.domain,
										total_citations: group.totalCitations,
										url_count: group.urlCount,
										providers: Array.from(group.providers).join(", "),
									})),
									...displayedSources.map((source) => ({
										section: "url_performance",
										url: source.url,
										url_path: getUrlPath(source.url),
										title: source.title,
										total_citations: source.totalSources ?? 0,
										domain: getDomain(source.url) || "",
										models: [
											...new Set(
												(source.excerpts ?? [])
													.map((e) => e.model_provider)
													.filter(Boolean),
											),
										].join(", "),
										cited_texts: (source.excerpts ?? [])
											.map((e) =>
												e.cited_text ? cleanCitedText(e.cited_text) : "",
											)
											.filter(Boolean)
											.join(" | "),
									})),
									...domainGroups.flatMap((group) =>
										group.urls.flatMap((source) =>
											(source.excerpts ?? []).map((excerpt) => ({
												section: "citation_excerpts",
												domain: group.domain,
												url: source.url,
												url_path: getUrlPath(source.url),
												title: source.title,
												model: excerpt.model_provider ?? "",
												cited_text: excerpt.cited_text
													? cleanCitedText(excerpt.cited_text)
													: "",
											})),
										),
									),
								];
								downloadCsv(`sources-${workspaceId}-${Date.now()}.csv`, rows);
							}}
						/>
						<Select
							value={selectedProvider}
							onValueChange={setSelectedProvider}
						>
							<SelectTrigger className="h-10 w-[220px] rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
								<SelectValue placeholder="Select Provider" />
							</SelectTrigger>
							<SelectContent>
								{modelSelectors.map(({ value, label }) => {
									const icon =
										value === "All Models" ? "" : getModelFavicon(value);
									return (
										<SelectItem key={value} value={value}>
											<div className="flex items-center gap-2">
												{value === "All Models" ? (
													<Bot className="h-4 w-4 text-muted-foreground" />
												) : (
													<img
														src={icon}
														alt={value}
														className="h-4 w-4 rounded-sm"
													/>
												)}
												<span>{label}</span>
											</div>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						icon={Globe2}
						label="Domains"
						value={String(aggregate.totalDomains)}
						subtitle="Unique domains across selected model scope"
					/>
					<MetricCard
						icon={Link2}
						label="URLs"
						value={String(aggregate.totalUrls)}
						subtitle="Unique source URLs captured from responses"
					/>
					<MetricCard
						icon={BarChart3}
						label="Citations"
						value={String(aggregate.totalCitations)}
						subtitle={`Avg ${aggregate.avgCitationsPerUrl} citations per URL`}
					/>
					<MetricCard
						icon={BarChart3}
						label="Top Domain Share"
						value={`${aggregate.topDomainShare}%`}
						subtitle={`${aggregate.topDomain} concentration in total citations`}
						badgeFavicon={getFaviconUrls(aggregate.topDomain, "")[0] ?? null}
					/>
				</div>

				<div className="flex gap-3 border-b border-gray-200 dark:border-gray-800">
					<button
						className={`px-3 py-2 text-sm font-semibold transition-colors ${
							activeTab === "domains"
								? "border-blue-600 border-b-2 text-blue-600"
								: "text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
						}`}
						onClick={() => setActiveTab("domains")}
					>
						Domains
					</button>
					<button
						className={`px-3 py-2 text-sm font-semibold transition-colors ${
							activeTab === "citations"
								? "border-blue-600 border-b-2 text-blue-600"
								: "text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
						}`}
						onClick={() => setActiveTab("citations")}
					>
						Citations
					</button>
				</div>

				{!hasData ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-20 text-center dark:border-gray-800 dark:from-gray-900/70 dark:to-gray-900">
						<div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
							<SearchX className="h-5 w-5 text-gray-400" />
						</div>
						<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
							No source data for this filter
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Try another model filter to inspect source patterns.
						</p>
					</div>
				) : activeTab === "domains" ? (
					<div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
						<Table className="w-full">
							<TableHeader>
								<TableRow className="border-b border-gray-200 dark:border-gray-800">
									<TableHead className="w-[56px] px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										#
									</TableHead>
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Publisher
									</TableHead>
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										<SortableHeader
											column="share"
											currentSort={sortColumn}
											currentDirection={sortDirection}
											onSort={handleSort}
										>
											Share of Citations
										</SortableHeader>
									</TableHead>
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										<SortableHeader
											column="citations"
											currentSort={sortColumn}
											currentDirection={sortDirection}
											onSort={handleSort}
										>
											Total Citations
										</SortableHeader>
									</TableHead>
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										<SortableHeader
											column="urls"
											currentSort={sortColumn}
											currentDirection={sortDirection}
											onSort={handleSort}
										>
											Unique URLs
										</SortableHeader>
									</TableHead>
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Models
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedDomainGroups.map((domain, idx) => {
									const share = aggregate.totalCitations
										? (
												(domain.totalCitations / aggregate.totalCitations) *
												100
											).toFixed(1)
										: "0.0";
									const providers = [...domain.providers];

									return (
										<TableRow
											key={domain.domain}
											className="ui-list-item border-b border-gray-100 last:border-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/40"
										>
											<TableCell className="px-4 py-5 text-xs text-muted-foreground">
												{idx + 1}
											</TableCell>
											<TableCell className="px-4 py-5">
												<div className="flex items-center gap-2">
													<FaviconWithFallback url={domain.domain} />
													<a
														href={`https://${domain.domain}`}
														target="_blank"
														rel="noreferrer noopener"
														className="truncate text-sm font-semibold text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
													>
														{domain.domain}
													</a>
												</div>
											</TableCell>
											<TableCell className="px-4 py-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
												{share}%
											</TableCell>
											<TableCell className="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">
												{domain.totalCitations}
											</TableCell>
											<TableCell className="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">
												{domain.urlCount}
											</TableCell>
											<TableCell className="px-4 py-5">
												<div className="flex items-center gap-1.5">
													{providers.map((provider) => (
														<img
															key={`${domain.domain}-${provider}`}
															src={getModelFavicon(provider)}
															alt={provider}
															title={provider}
															className="h-4 w-4 rounded-sm"
														/>
													))}
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				) : (
					<div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
						<Table className="w-full table-fixed">
							<TableHeader>
								<TableRow className="border-b border-gray-200 dark:border-gray-800">
									<TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Source Reference
									</TableHead>
									<TableHead className="w-[300px] px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Citations & Models
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{domainGroups.map((group) => {
									const domainOpen = openDomain === group.domain;
									const groupProviders = [...group.providers];

									return (
										<Fragment key={group.domain}>
											<TableRow
												className="cursor-pointer border-b border-gray-100 bg-white hover:bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/40"
												onClick={() =>
													setOpenDomain(domainOpen ? null : group.domain)
												}
											>
												<TableCell className="px-4 py-5">
													<div className="flex items-center gap-2">
														<ChevronRight
															className={`h-4 w-4 text-muted-foreground transition-transform ${
																domainOpen ? "rotate-90" : ""
															}`}
														/>
														<FaviconWithFallback url={group.domain} />
														<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
															{group.domain}
														</span>
													</div>
												</TableCell>
												<TableCell className="px-4 py-5 text-right text-sm text-gray-700 dark:text-gray-200">
													<span className="font-semibold">
														{formatCitationLabel(group.totalCitations)}
													</span>
													<span className="mx-2 text-gray-300">•</span>
													{group.urlCount} URLs
													<span className="mx-2 text-gray-300">•</span>
													<div className="inline-flex items-center gap-1.5 align-middle">
														{groupProviders.map((provider) => (
															<img
																key={`${group.domain}-${provider}`}
																src={getModelFavicon(provider)}
																alt={provider}
																title={provider}
																className="h-4 w-4 rounded-sm"
															/>
														))}
													</div>
												</TableCell>
											</TableRow>

											{domainOpen &&
												group.urls.map((source) => {
													const urlOpen = openUrl === source.url;
													const providers = [
														...new Set(
															source.excerpts
																.map((e) => e.model_provider)
																.filter(Boolean),
														),
													] as string[];

													return (
														<Fragment key={source.url}>
															<TableRow
																className="cursor-pointer border-b border-gray-100 bg-white hover:bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/40"
																onClick={() =>
																	setOpenUrl(urlOpen ? null : source.url)
																}
															>
																<TableCell className="px-4 py-5 pl-12">
																	<div className="flex items-start gap-2">
																		<ChevronRight
																			className={`mt-0.5 h-3.5 w-3.5 text-muted-foreground transition-transform ${
																				urlOpen ? "rotate-90" : ""
																			}`}
																		/>
																		<div className="mt-0.5">
																			<FaviconWithFallback
																				url={source.url}
																				size="sm"
																			/>
																		</div>
																		<div className="min-w-0">
																			<p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
																				{source.title || "Untitled source"}
																			</p>
																			<div className="mt-1.5 flex items-center gap-2">
																				<span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
																					{getUrlPath(source.url)}
																				</span>
																				<a
																					href={source.url}
																					target="_blank"
																					rel="noreferrer noopener"
																					onClick={(e) => e.stopPropagation()}
																					className="text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
																				>
																					<ExternalLink className="h-3.5 w-3.5" />
																				</a>
																			</div>
																		</div>
																	</div>
																</TableCell>
																<TableCell className="px-4 py-5 text-right text-sm text-gray-700 dark:text-gray-200">
																	<span className="font-semibold">
																		{formatCitationLabel(source.totalSources)}
																	</span>
																	<span className="mx-2 text-gray-300">•</span>
																	<div className="inline-flex items-center gap-1.5 align-middle">
																		{providers.map((provider) => (
																			<img
																				key={`${source.url}-${provider}`}
																				src={getModelFavicon(provider)}
																				alt={provider}
																				title={provider}
																				className="h-4 w-4 rounded-sm"
																			/>
																		))}
																	</div>
																</TableCell>
															</TableRow>

															{urlOpen &&
																source.excerpts.map((excerpt, idx) => (
																	<TableRow
																		key={`${source.url}-${idx}`}
																		className="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
																	>
																		<TableCell className="px-4 py-5 pl-20">
																			<div className="max-w-full rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/60 p-4 dark:border-gray-800 dark:from-gray-900 dark:to-gray-900/80">
																				<p className="line-clamp-5 overflow-hidden text-sm font-medium leading-relaxed text-gray-900 [overflow-wrap:anywhere] break-words dark:text-gray-100">
																					{excerpt.cited_text?.trim()
																						? cleanCitedText(excerpt.cited_text)
																						: "This citation has no extracted quoted text."}
																				</p>
																			</div>
																		</TableCell>
																		<TableCell className="px-4 py-5 text-right">
																			{excerpt.model_provider ? (
																				<div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-900">
																					<img
																						src={getModelFavicon(
																							excerpt.model_provider,
																						)}
																						alt=""
																						className="h-3.5 w-3.5 rounded-sm"
																					/>
																					{modelSelectors.find(
																						(m) =>
																							m.value ===
																							excerpt.model_provider,
																					)?.label ?? excerpt.model_provider}
																				</div>
																			) : (
																				<span className="text-xs text-muted-foreground">
																					Unknown model
																				</span>
																			)}
																		</TableCell>
																	</TableRow>
																))}
														</Fragment>
													);
												})}
										</Fragment>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
