"use client";

import {
	formDialogBodyClassName,
	formDialogContentClassName,
	formDialogFooterClassName,
	formDialogHeaderClassName,
	formFieldClassName,
	formHintClassName,
	formLabelClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { authClient } from "@/lib/auth/auth-client";
import { signOutAndRedirect } from "@/lib/auth/logout";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type {
	AnalysisRecord,
	DomainStats,
	GroupedSource,
	SourceExcerpt,
} from "@oneglanse/types";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	toast,
} from "@oneglanse/ui";
import {
	buildDetailedAnalysisCsvRow,
	getUniqueModelProviders,
	joinCitedTexts,
} from "@oneglanse/utils";
import { cn } from "@oneglanse/utils";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDashboardData } from "../dashboard/_hooks/use-dashboard-data";
import type { DashboardMetrics } from "../dashboard/_utils/types";
import { useLayoutUserEmail } from "../workspace-context";

function getWorkspaceActionPriorities(
	metrics: DashboardMetrics,
	promptCount: number,
): string[] {
	const priorities = [
		metrics.aggregateStats.presenceRate < 70
			? "Increase brand mention frequency across high-intent prompts."
			: null,
		(metrics.avgRank.position ?? 99) > 3
			? "Improve ranking consistency by strengthening comparison-oriented messaging."
			: null,
		metrics.impactMetrics.topPickRate < 35
			? "Raise top-pick conversion with stronger differentiators and proof points."
			: null,
		metrics.impactMetrics.criticalRiskCount > 0
			? "Resolve critical risk signals found in model answers."
			: null,
		promptCount < 5
			? "Add more prompts to improve coverage across buyer intent categories."
			: null,
		metrics.totalCitations === 0
			? "No citations captured yet. Publish authoritative content for AI models to reference."
			: null,
	].filter((priority): priority is string => priority !== null);

	return priorities.length > 0
		? priorities
		: ["Maintain current trajectory and scale winning prompt themes."];
}

export default function SettingsPage() {
	const searchParams = useSafeSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const subtleBorderButtonClassName = "border-gray-200/80 dark:border-gray-800";
	const destructiveSubtleBorderButtonClassName =
		"border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-200";

	// User email from layout context (server-fetched, no waterfall)
	const userEmail = useLayoutUserEmail();

	// Delete account state
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const deleteAccountMutation = api.workspace.deleteAccount.useMutation();

	const userPromptsQuery = api.prompt.fetchUserPrompts.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const analysisQuery = api.analysis.fetchAnalysis.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const sourcesQuery = api.prompt.fetchPromptSources.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const workspaceQuery = api.workspace.getById.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);

	const dashboardMetrics = useDashboardData(
		Array.isArray(analysisQuery.data) ? analysisQuery.data : [],
		"All Models",
		"all",
		{
			name: workspaceQuery.data?.name,
			domain: workspaceQuery.data?.domain,
		},
	);

	// Delete account handler
	const handleDeleteAccount = async () => {
		if (deleteConfirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
			toast.error("Email does not match. Please type your email to confirm.");
			return;
		}
		setIsDeletingAccount(true);
		try {
			await deleteAccountMutation.mutateAsync();
			await signOutAndRedirect("/login");
			toast.success("Your account has been deleted.");
		} catch (err) {
			console.error(err);
			toast.error(
				err instanceof Error ? err.message : "Failed to delete account.",
			);
		} finally {
			setIsDeletingAccount(false);
		}
	};

	const handleExportAllJson = () => {
		const userPrompts = userPromptsQuery.data ?? [];
		const analysisData = analysisQuery.data ?? [];
		const sourceData = sourcesQuery.data ?? null;
		const sourceStats = sourceData?.sourceStats;
		const combinedSources = sourceStats?.combined ?? [];
		const domainStatsRaw = sourceData?.domain_stats;
		const domainStats = Array.isArray(domainStatsRaw)
			? domainStatsRaw
			: (domainStatsRaw?.combined ?? []);
		const m = dashboardMetrics;

		const citationRows = combinedSources.flatMap((source: GroupedSource) =>
			(source.excerpts ?? []).map((excerpt: SourceExcerpt) => ({
				url: source.url ?? "",
				title: source.title ?? "",
				totalCitations: source.totalSources ?? 0,
				modelProvider: excerpt.model_provider ?? "",
				citedText: excerpt.cited_text ?? "",
			})),
		);
		const analysisRecords = Array.isArray(analysisData) ? analysisData : [];
		const analysisMetricRows = analysisRecords.map((record: AnalysisRecord) =>
			buildDetailedAnalysisCsvRow(record),
		);
		const promptRows = userPrompts.map((prompt) => ({
			promptId: prompt.id,
			prompt: prompt.prompt,
			createdAt: prompt.created_at,
		}));
		const sourceRows = combinedSources.map((source: GroupedSource) => {
			const models = getUniqueModelProviders(source.excerpts ?? []);

			return {
				url: source.url,
				title: source.title,
				totalCitations: source.totalSources ?? 0,
				modelCount: models.length,
				models,
				excerptCount: source.excerpts?.length ?? 0,
				citedTexts: joinCitedTexts(source.excerpts ?? []),
			};
		});
		const dashboardSourceRows = m.sourcesIntelligence.map((source) => ({
			domain: source.domain,
			favicon: source.favicon,
			citationCount: source.citationCount,
			uniqueRecordCount: source.uniqueRecords.size,
			modelCount: source.models.size,
			models: [...source.models],
			uniqueRecords: [...source.uniqueRecords],
		}));
		const actionPriorities = getWorkspaceActionPriorities(
			m,
			userPrompts.length,
		);

		downloadJson(`workspace-all-${workspaceId}-${Date.now()}.json`, {
			generatedAt: new Date().toISOString(),
			report: {
				title: "Workspace AI Visibility Export",
				version: "2.0",
			},
			overview: {
				promptCount: userPrompts.length,
				analysisRecordCount: analysisRecords.length,
				sourceUrlCount: combinedSources.length,
				citationCount: citationRows.length,
			},
			metrics: {
				dashboard: {
					brandName: m.brandName,
					brandDomain: m.brandDomain,
					avgRank: m.avgRank,
					avgSentiment: m.avgSentiment,
					impactMetrics: m.impactMetrics,
					aggregateStats: m.aggregateStats,
					totalCitations: m.totalCitations,
				},
				brandPerception: m.brandPerception,
				competitors: m.competitorData,
				citationSources: dashboardSourceRows,
				sourceDomains: domainStats,
				actionPriorities,
			},
			exports: {
				dashboard: {
					analysisCount: analysisRecords.length,
					records: analysisMetricRows,
				},
				prompts: {
					promptCount: userPrompts.length,
					prompts: promptRows,
					analyses: analysisMetricRows,
				},
				sources: {
					domainStats,
					groupedSources: sourceRows,
					citations: citationRows,
				},
			},
		});
	};

	const handleExportAllCsv = () => {
		const userPrompts = userPromptsQuery.data ?? [];
		const analysisData = Array.isArray(analysisQuery.data)
			? analysisQuery.data
			: [];
		const sourceStats = sourcesQuery.data?.sourceStats;
		const combinedSources = sourceStats?.combined ?? [];
		const domainStatsRaw = sourcesQuery.data?.domain_stats;
		const domainStats = Array.isArray(domainStatsRaw)
			? domainStatsRaw
			: (domainStatsRaw?.combined ?? []);
		const m = dashboardMetrics;
		const actionPriorities = getWorkspaceActionPriorities(
			m,
			userPrompts.length,
		);

		const rows: Array<Record<string, unknown>> = [
			// Overview
			{ section: "overview", metric: "Prompts", value: userPrompts.length },
			{
				section: "overview",
				metric: "Analysis Records",
				value: analysisData.length,
			},
			{
				section: "overview",
				metric: "Source URLs",
				value: combinedSources.length,
			},
			{
				section: "overview",
				metric: "Citation Excerpts",
				value: combinedSources.reduce(
					(count: number, source: GroupedSource) =>
						count + (source.excerpts?.length ?? 0),
					0,
				),
			},
			// Prompt inventory
			...userPrompts.map((prompt) => ({
				section: "prompt_inventory",
				prompt_id: prompt.id,
				prompt: prompt.prompt,
				created_at: prompt.created_at,
			})),
			// Aggregate metrics
			{
				section: "aggregate_metrics",
				metric: "Total Responses",
				value: m.impactMetrics.totalResponses,
			},
			{
				section: "aggregate_metrics",
				metric: "Presence Rate",
				value: `${m.aggregateStats.presenceRate}%`,
			},
			{
				section: "aggregate_metrics",
				metric: "Avg Rank",
				value: m.avgRank.position ?? "N/A",
			},
			{
				section: "aggregate_metrics",
				metric: "Recommendation Rate",
				value: `${m.impactMetrics.recommendationRate}%`,
			},
			{
				section: "aggregate_metrics",
				metric: "Top Pick Rate",
				value: `${m.impactMetrics.topPickRate}%`,
			},
			{
				section: "aggregate_metrics",
				metric: "Avg Sentiment",
				value: m.avgSentiment.score,
			},
			{
				section: "aggregate_metrics",
				metric: "Avg Visibility",
				value: `${m.impactMetrics.avgVisibility}%`,
			},
			{
				section: "aggregate_metrics",
				metric: "Critical Risks",
				value: m.impactMetrics.criticalRiskCount,
			},
			{
				section: "aggregate_metrics",
				metric: "Top Competitor",
				value: m.aggregateStats.topCompetitor,
			},
			{
				section: "aggregate_metrics",
				metric: "Top Competitor Domain",
				value: m.aggregateStats.topCompetitorDomain ?? "",
			},
			{
				section: "aggregate_metrics",
				metric: "Total Citations",
				value: m.totalCitations,
			},
			...actionPriorities.map((priority, index) => ({
				section: "action_priorities",
				priority: index + 1,
				action: priority,
			})),
			// Brand perception
			{
				section: "brand_perception",
				metric: "Best Known For",
				value: m.brandPerception.bestKnownFor ?? "",
			},
			{
				section: "brand_perception",
				metric: "Pricing Perception",
				value: m.brandPerception.pricingPerception,
			},
			{
				section: "brand_perception",
				metric: "Core Claims",
				value: m.brandPerception.coreClaims.join(" | "),
			},
			{
				section: "brand_perception",
				metric: "Differentiators",
				value: m.brandPerception.differentiators.join(" | "),
			},
			// Competitor table
			...m.competitorData
				.filter((c) => !c.isBrand)
				.map((c) => ({
					section: "competitors",
					name: c.name,
					domain: c.domain,
					appearances: c.appearances,
					visibility: c.visibility ?? "",
					avg_rank: c.avgRank ?? "",
					avg_sentiment: c.avgSentiment,
					recommendation_count: c.recCount,
				})),
			// Citation source table
			...m.sourcesIntelligence.map((s) => ({
				section: "citation_sources",
				domain: s.domain,
				citation_count: s.citationCount,
				unique_record_count: s.uniqueRecords.size,
				model_count: s.models.size,
				models: [...s.models].join(" | "),
				unique_records: [...s.uniqueRecords].join(" | "),
			})),
			// Domain performance
			...domainStats.map((domain: DomainStats) => ({
				section: "source_domain_performance",
				domain: domain.domain,
				total_sources: domain.totalOccurrences,
				source_text_count: domain.sourceTextCount,
				percentage: domain.usedPercentageAcrossAllDomains,
				avg_sources_per_domain: domain.avgSourcesPerDomain,
			})),
			// URL performance
			...combinedSources.map((source: GroupedSource) => {
				const models = getUniqueModelProviders(source.excerpts ?? []);

				return {
					section: "source_url_performance",
					url: source.url,
					title: source.title,
					total_citations: source.totalSources ?? 0,
					model_count: models.length,
					models: models.join(", "),
					excerpt_count: source.excerpts?.length ?? 0,
					cited_texts: joinCitedTexts(source.excerpts ?? []),
				};
			}),
			// Source excerpts
			...combinedSources.flatMap((source: GroupedSource) =>
				(source.excerpts ?? []).map((excerpt: SourceExcerpt) => ({
					section: "source_excerpts",
					url: source.url,
					title: source.title,
					model: excerpt.model_provider ?? "",
					cited_text: excerpt.cited_text ?? "",
				})),
			),
			// Full per-record detail
			...analysisData.map((record: AnalysisRecord) =>
				buildDetailedAnalysisCsvRow(record),
			),
		];

		downloadCsv(`workspace-all-${workspaceId}-${Date.now()}.csv`, rows);
	};

	const hasAnyExportData =
		(userPromptsQuery.data?.length ?? 0) > 0 ||
		(analysisQuery.data?.length ?? 0) > 0 ||
		(sourcesQuery.data?.sourceStats?.combined?.length ?? 0) > 0;

	return (
		<div className="web-page-panel max-w-4xl">
			{workspaceId ? (
				<section>
					<div className="mb-4 flex items-center gap-2">
						<h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
							Export Data
						</h2>
					</div>
					<div className={cn(formPanelClassName, "space-y-3 p-5")}>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Export All Data
								</p>
								<p className={formHintClassName}>
									Export Dashboard, Prompts, and Sources data together in one
									file.
								</p>
							</div>
							<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
								<Button
									variant="outline"
									className={cn(
										formSecondaryButtonClassName,
										subtleBorderButtonClassName,
										"w-full gap-2 sm:w-auto",
									)}
									onClick={handleExportAllJson}
									disabled={
										userPromptsQuery.isLoading ||
										analysisQuery.isLoading ||
										sourcesQuery.isLoading ||
										!hasAnyExportData
									}
								>
									<Download className="h-4 w-4" />
									Export All JSON
								</Button>
								<Button
									variant="outline"
									className={cn(
										formSecondaryButtonClassName,
										subtleBorderButtonClassName,
										"w-full gap-2 sm:w-auto",
									)}
									onClick={handleExportAllCsv}
									disabled={
										userPromptsQuery.isLoading ||
										analysisQuery.isLoading ||
										sourcesQuery.isLoading ||
										!hasAnyExportData
									}
								>
									<Download className="h-4 w-4" />
									Export All CSV
								</Button>
							</div>
						</div>
					</div>
				</section>
			) : null}

			{/* Danger Zone */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
						Account
					</h2>
				</div>
				<div className={cn(formPanelClassName, "space-y-3 p-5")}>
					<div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
								Delete Account
							</p>
							<p className={cn(formHintClassName, "mt-1")}>
								Permanently delete your account, all your workspaces, and all
								associated data. This cannot be undone.
							</p>
						</div>
						<Button
							className={cn(
								formSecondaryButtonClassName,
								subtleBorderButtonClassName,
								destructiveSubtleBorderButtonClassName,
								"h-10 w-auto shrink-0 self-start px-4 sm:self-auto",
							)}
							onClick={() => {
								setDeleteConfirmEmail("");
								setShowDeleteDialog(true);
							}}
						>
							Delete Account
						</Button>
					</div>
				</div>
			</section>

			{/* Delete Account Confirmation Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent className={formDialogContentClassName}>
					<DialogHeader className={formDialogHeaderClassName}>
						<DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-gray-950 dark:text-gray-50">
							Delete Account
						</DialogTitle>
					</DialogHeader>

					<div className="px-4 sm:px-4.5 lg:px-5">
						<div className="rounded-[var(--app-radius)] border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
							<p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
								If you are the sole owner of any organization, that organization
								and all its workspaces will be permanently deleted along with
								your account.
							</p>
						</div>
					</div>

					<div className={formDialogBodyClassName}>
						<div className="space-y-2">
							<Label
								htmlFor="delete-confirm-email"
								className="text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Type your email{" "}
								<span className="font-mono text-xs text-gray-500">
									({userEmail})
								</span>{" "}
								to confirm
							</Label>

							<Input
								id="delete-confirm-email"
								type="email"
								placeholder={userEmail}
								value={deleteConfirmEmail}
								onChange={(e) => setDeleteConfirmEmail(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleDeleteAccount()}
								className={cn(formFieldClassName, "h-9")}
							/>
						</div>
					</div>

					<DialogFooter className={formDialogFooterClassName}>
						<Button
							className={cn(
								formSecondaryButtonClassName,
								subtleBorderButtonClassName,
								"w-full sm:w-auto",
							)}
							onClick={() => setShowDeleteDialog(false)}
							disabled={isDeletingAccount}
						>
							Cancel
						</Button>

						<Button
							className={cn(
								formSecondaryButtonClassName,
								subtleBorderButtonClassName,
								destructiveSubtleBorderButtonClassName,
								"w-full sm:w-auto",
							)}
							onClick={handleDeleteAccount}
							disabled={
								isDeletingAccount ||
								deleteConfirmEmail.trim().toLowerCase() !==
									userEmail.toLowerCase()
							}
						>
							{isDeletingAccount ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Permanently delete account"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
