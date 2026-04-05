"use client";

import { ExportMenu } from "@/components/export-menu";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import type { GroupedSource, SourceGroupResult } from "@oneglanse/types";
import {
	Button,
	EmptyStatePanel,
	ProviderModelSelect,
	SectionHeading,
	Skeleton,
	type SourcePanelCitationDomain,
	type SourcePanelDomainRow,
	type SourcePanelMetrics,
	SourcesIntelligencePanel,
	TemporaryIssueState,
	WorkspaceRequiredState,
} from "@oneglanse/ui";
import {
	cleanCitedText,
	getDomain,
	getUniqueModelProviders,
	getUrlPath,
	joinCitedTexts,
} from "@oneglanse/utils";
import { AlertTriangle, FileText, Globe2, Link2, SearchX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePromptSources } from "../prompts/_lib/queries/prompt.queries";

type DomainGroup = {
	domain: string;
	totalCitations: number;
	urlCount: number;
	providers: Set<string>;
	urls: GroupedSource[];
};

const SOURCES_METRIC_SKELETON_KEYS = [
	"sources-metric-a",
	"sources-metric-b",
	"sources-metric-c",
	"sources-metric-d",
] as const;

export default function SourcesPage(): React.JSX.Element {
	const [selectedProvider, setSelectedProvider] =
		useState<string>("All Models");

	const searchParams = useSafeSearchParams();
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

	const metrics = useMemo<SourcePanelMetrics>(() => {
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
			totalDomains,
			totalUrls,
			totalCitations,
			avgCitationsPerUrl,
			topDomain: domainGroups[0]?.domain ?? "N/A",
			topDomainShare,
		};
	}, [displayedSources, domainGroups]);

	const domainRows = useMemo<SourcePanelDomainRow[]>(
		() =>
			domainGroups.map((group) => ({
				domain: group.domain,
				share:
					metrics.totalCitations > 0
						? (group.totalCitations / metrics.totalCitations) * 100
						: 0,
				totalCitations: group.totalCitations,
				urlCount: group.urlCount,
				providers: [...group.providers],
			})),
		[domainGroups, metrics.totalCitations],
	);

	const citationDomains = useMemo<SourcePanelCitationDomain[]>(
		() =>
			domainGroups.map((group) => ({
				domain: group.domain,
				totalCitations: group.totalCitations,
				urlCount: group.urlCount,
				providers: [...group.providers],
				urls: group.urls.map((source) => ({
					url: source.url,
					title: source.title,
					totalCitations: source.totalSources ?? 0,
					providers: [...getUniqueModelProviders(source.excerpts)],
					excerpts: source.excerpts.map((excerpt) => ({
						modelProvider: excerpt.model_provider ?? undefined,
						citedText: excerpt.cited_text
							? cleanCitedText(excerpt.cited_text)
							: undefined,
					})),
				})),
			})),
		[domainGroups],
	);

	if (!workspaceId) {
		return (
			<WorkspaceRequiredState
				icon={SearchX}
				title="Pick a Workspace"
				description="Open a workspace to inspect source influence."
			/>
		);
	}

	if (isLoading && !promptSources) {
		return (
			<div className="web-page-wide">
				<div className="web-page-wide-inner space-y-4">
					<Skeleton className="h-10 w-56" />
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{SOURCES_METRIC_SKELETON_KEYS.map((key) => (
							<Skeleton key={key} className="h-28 rounded-2xl" />
						))}
					</div>
					<Skeleton className="h-[480px] rounded-2xl" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<TemporaryIssueState
				icon={AlertTriangle}
				title="Sources Are Unavailable"
				description="We couldn’t load citation data right now."
			/>
		);
	}

	if (!sourceStats) {
		return (
			<EmptyStatePanel
				icon={Globe2}
				title="See Who Shapes the Answer"
				description="Run prompts to reveal which domains and URLs AI models keep citing."
				examplesLabel="Source signals you'll uncover"
				examples={[
					{ icon: Globe2, label: "Top cited domains" },
					{ icon: Link2, label: "Most referenced URLs" },
					{ icon: FileText, label: "Cited text by provider" },
				]}
				action={
					<Button asChild>
						<Link href={`/prompts?workspace=${workspaceId}`}>Run prompts</Link>
					</Button>
				}
			/>
		);
	}

	if (displayedSources.length === 0) {
		return (
			<EmptyStatePanel
				icon={Globe2}
				title="Source Patterns Appear Here"
				description="When source data is available, this page shows the domains, URLs, and cited text shaping model answers."
				examplesLabel="What you'll see here"
				examples={[
					{ icon: Globe2, label: "Top cited domains" },
					{ icon: Link2, label: "Most referenced URLs" },
					{ icon: FileText, label: "Cited text by provider" },
				]}
			/>
		);
	}

	const hasExportableData = displayedSources.length > 0;

	return (
		<div className="web-page-wide">
			<div className="web-page-wide-inner ui-stagger space-y-6 sm:space-y-8">
				<SectionHeading
					as="h1"
					title="Sources Intelligence"
					description="High-signal view of where model answers are sourced from."
					className="mb-0 flex-wrap items-center gap-y-4"
					titleClassName="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100"
					descriptionClassName="mt-2 text-sm font-normal"
					trailing={
						<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
							<ExportMenu
								className="w-full sm:w-auto"
								disabled={!hasExportableData}
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
											metrics.totalCitations > 0
												? Number(
														(
															(group.totalCitations / metrics.totalCitations) *
															100
														).toFixed(1),
													)
												: 0,
										urlCount: group.urlCount,
									}));
									const concentrationRisk =
										metrics.topDomainShare >= 45
											? "high"
											: metrics.topDomainShare >= 30
												? "moderate"
												: "healthy";

									downloadJson(`sources-${workspaceId}-${Date.now()}.json`, {
										generatedAt: new Date().toISOString(),
										workspaceId,
										report: {
											title: "Sources Intelligence Export",
											version: "2.0",
											filters: { selectedProvider, activeTab: "all" },
										},
										overview: {
											totalDomains: metrics.totalDomains,
											totalUrls: metrics.totalUrls,
											totalCitations: metrics.totalCitations,
											avgCitationsPerUrl: metrics.avgCitationsPerUrl,
										},
										impactSummary: {
											topDomain: metrics.topDomain,
											topDomainShare: `${metrics.topDomainShare}%`,
											sourceConcentrationRisk: concentrationRisk,
										},
										leaderboards: { topDomains },
										detailedData: {
											aggregate: metrics,
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
											value: metrics.totalDomains,
										},
										{
											section: "overview",
											metric: "URLs",
											value: metrics.totalUrls,
										},
										{
											section: "overview",
											metric: "Citations",
											value: metrics.totalCitations,
										},
										{
											section: "overview",
											metric: "Top Domain Share",
											value: `${metrics.topDomainShare}%`,
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
											models: getUniqueModelProviders(
												source.excerpts ?? [],
											).join(", "),
											cited_texts: joinCitedTexts(source.excerpts ?? [], {
												clean: true,
											}),
										})),
									];
									downloadCsv(`sources-${workspaceId}-${Date.now()}.csv`, rows);
								}}
							/>
							<ProviderModelSelect
								value={selectedProvider}
								onValueChange={setSelectedProvider}
								triggerClassName="w-full sm:w-auto"
							/>
						</div>
					}
				/>

				<div className="pt-4 sm:pt-5">
					<SourcesIntelligencePanel
						metrics={metrics}
						domainRows={domainRows}
						citationDomains={citationDomains}
						enableDomainSorting
						containerVariant="plain"
					/>
				</div>
			</div>
		</div>
	);
}
