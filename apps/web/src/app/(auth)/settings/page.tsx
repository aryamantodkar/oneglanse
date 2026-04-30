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
import { downloadHtmlReport } from "@/lib/export/report";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type {
	AnalysisRecord,
	DomainStats,
	GroupedSource,
	Source,
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
	buildAnalysisCsvRow,
	getUniqueModelProviders,
	joinCitedTexts,
} from "@oneglanse/utils";
import { cn } from "@oneglanse/utils";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLayoutUserEmail } from "../workspace-context";

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

		downloadJson(`workspace-all-${workspaceId}-${Date.now()}.json`, {
			generatedAt: new Date().toISOString(),
			workspace: null,
			organization: null,
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
			exports: {
				dashboard: {
					analysisCount: analysisRecords.length,
					records: analysisRecords,
				},
				prompts: {
					promptCount: userPrompts.length,
					prompts: userPrompts,
					analyses: analysisData,
				},
				sources: {
					domainStats,
					groupedSources: combinedSources,
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

		const rows: Array<Record<string, unknown>> = [
			{
				section: "overview",
				metric: "Prompts",
				value: userPrompts.length,
			},
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
			...userPrompts.map((prompt) => ({
				section: "prompt_definitions",
				prompt_id: prompt.id,
				prompt: prompt.prompt,
				created_at: prompt.created_at,
			})),
			...analysisData.map((record: AnalysisRecord) => ({
				prompt_id: record.prompt_id,
				...buildAnalysisCsvRow(record, "analysis_metrics"),
			})),
			...domainStats.map((domain: DomainStats) => ({
				section: "source_domain_performance",
				domain: domain.domain,
				total_sources: domain.totalOccurrences,
				percentage: domain.usedPercentageAcrossAllDomains,
			})),
			...combinedSources.map((source: GroupedSource) => ({
				section: "source_url_performance",
				url: source.url,
				title: source.title,
				total_citations: source.totalSources ?? 0,
				models: getUniqueModelProviders(source.excerpts ?? []).join(", "),
				cited_texts: joinCitedTexts(source.excerpts ?? []),
			})),
			...combinedSources.flatMap((source: GroupedSource) =>
				(source.excerpts ?? []).map((excerpt: SourceExcerpt) => ({
					section: "source_excerpts",
					url: source.url,
					title: source.title,
					model: excerpt.model_provider ?? "",
					cited_text: excerpt.cited_text ?? "",
				})),
			),
			...analysisData.flatMap((record: AnalysisRecord) =>
				(record.sources ?? []).map((source: Source) => ({
					section: "analysis_sources",
					prompt_id: record.prompt_id,
					model: record.model_provider,
					source_title: source.title ?? "",
					source_url: source.url ?? "",
					source_domain: source.domain ?? "",
					source_cited_text: source.cited_text ?? "",
				})),
			),
			...analysisData.map((record: AnalysisRecord) => ({
				section: "analysis_full_json",
				prompt_id: record.prompt_id,
				model: record.model_provider,
				brand_analysis_json: JSON.stringify(record.brand_analysis ?? {}),
			})),
		];

		downloadCsv(`workspace-all-${workspaceId}-${Date.now()}.csv`, rows);
	};

	const handleExportAllReport = () => {
		const userPrompts = userPromptsQuery.data ?? [];
		const analysisData = Array.isArray(analysisQuery.data)
			? analysisQuery.data
			: [];
		const combinedSources = sourcesQuery.data?.sourceStats?.combined ?? [];
		const domainStatsRaw = sourcesQuery.data?.domain_stats;
		const domainStats = Array.isArray(domainStatsRaw)
			? domainStatsRaw
			: (domainStatsRaw?.combined ?? []);

		const analyzedRecords = analysisData.filter(
			(r: AnalysisRecord) => r.is_analysed && r.brand_analysis,
		);
		const avgGeo =
			analyzedRecords.length > 0
				? Math.round(
						analyzedRecords.reduce(
							(s: number, r: AnalysisRecord) =>
								s + (r.brand_analysis?.geoScore?.overall ?? 0),
							0,
						) / analyzedRecords.length,
					)
				: 0;
		const presenceRate =
			analyzedRecords.length > 0
				? Math.round((analyzedRecords.length / analysisData.length) * 100)
				: 0;
		const totalCitations = combinedSources.reduce(
			(sum: number, s: GroupedSource) => sum + (s.totalSources ?? 0),
			0,
		);

		const topDomainRows = (domainStats as DomainStats[])
			.slice(0, 5)
			.map((d: DomainStats) => ({
				label: d.domain,
				value: `${d.totalOccurrences} mention${d.totalOccurrences === 1 ? "" : "s"}`,
			}));

		const topPromptRows = [...analyzedRecords]
			.sort(
				(a: AnalysisRecord, b: AnalysisRecord) =>
					(b.brand_analysis?.geoScore?.overall ?? 0) -
					(a.brand_analysis?.geoScore?.overall ?? 0),
			)
			.slice(0, 5)
			.map((r: AnalysisRecord) => ({
				label: r.prompt.length > 60 ? `${r.prompt.slice(0, 60)}…` : r.prompt,
				value: String(r.brand_analysis?.geoScore?.overall ?? "—"),
				sub: "GEO score",
			}));

		const actions = [
			presenceRate < 70
				? "Increase brand mention frequency across high-intent prompts."
				: null,
			userPrompts.length < 5
				? "Add more prompts to improve coverage across buyer intent categories."
				: null,
			totalCitations === 0
				? "No citations captured yet — publish content for AI models to reference."
				: null,
		].filter((s): s is string => s !== null);

		downloadHtmlReport(`workspace-report-${workspaceId}-${Date.now()}.html`, {
			title: "Workspace AI Visibility Report",
			subtitle: `${userPrompts.length} prompts · ${analysisData.length} responses · ${totalCitations} citations`,
			generatedAt: new Date().toLocaleString(),
			metrics: [
				{
					label: "Analyzed Responses",
					value: analyzedRecords.length,
					highlight: true,
				},
				{ label: "Prompts", value: userPrompts.length },
				{ label: "Avg GEO Score", value: avgGeo },
				{ label: "Total Citations", value: totalCitations },
			],
			actions:
				actions.length > 0
					? actions.map((text) => ({ text }))
					: [
							{
								text: "Workspace is performing well. Continue scaling prompt coverage.",
							},
						],
			sections: [
				...(topDomainRows.length > 0
					? [{ title: "Top Citation Domains", rows: topDomainRows }]
					: []),
				...(topPromptRows.length > 0
					? [{ title: "Strongest Prompts by GEO Score", rows: topPromptRows }]
					: []),
			],
		});
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
									onClick={handleExportAllReport}
									disabled={
										userPromptsQuery.isLoading ||
										analysisQuery.isLoading ||
										sourcesQuery.isLoading ||
										!hasAnyExportData
									}
								>
									<Download className="h-4 w-4" />
									Export Report
								</Button>
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
