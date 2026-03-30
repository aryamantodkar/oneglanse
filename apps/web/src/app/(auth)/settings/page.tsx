"use client";

import { authClient } from "@/lib/auth/auth-client";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import { api } from "@/trpc/react";
import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import {
	type AnalysisRecord,
	type DomainStats,
	type GroupedSource,
	type Source,
	type SourceExcerpt,
} from "@oneglanse/types";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Download, Loader2, Settings } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLayoutUserEmail } from "../workspace-context";

export default function SettingsPage() {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const router = useRouter();

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
			await authClient.signOut();
			toast.success("Your account has been deleted.");
			router.push("/login");
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

	const hasAnyExportData =
		(userPromptsQuery.data?.length ?? 0) > 0 ||
		(analysisQuery.data?.length ?? 0) > 0 ||
		(sourcesQuery.data?.sourceStats?.combined?.length ?? 0) > 0;

	return (
		<div className="web-page-panel max-w-4xl">
			{/* Page Header */}
			<div className="mb-6 flex items-center gap-2">
				<Settings className="h-6 w-6 shrink-0 text-gray-500" />
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					Settings
				</h1>
			</div>

			{workspaceId ? (
				<section>
					<div className="mb-4 flex items-center gap-2">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Export Data
						</h2>
					</div>
					<div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Export All Data
								</p>
								<p className="text-xs text-gray-500">
									Export Dashboard, Prompts, and Sources data together in one
									file.
								</p>
							</div>
							<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
								<Button
									variant="outline"
									className="w-full gap-2 sm:w-auto"
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
									className="w-full gap-2 sm:w-auto"
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

			<ProviderConnectionsPanel />

			{/* Danger Zone */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Account
					</h2>
				</div>
				<div className="rounded-lg border border-red-200 p-4 dark:border-red-900/50">
					<div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
								Delete Account
							</p>
							<p className="mt-1 text-xs text-gray-500">
								Permanently delete your account, all your workspaces, and all
								associated data. This cannot be undone.
							</p>
						</div>
						<Button
							variant="outline"
							className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-500 dark:hover:bg-red-950/30"
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-red-600 dark:text-red-500">
							Delete Account
						</DialogTitle>
						<DialogDescription>
							This action is permanent and cannot be undone. All your
							workspaces, prompts, and data will be permanently deleted.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/20">
							<p className="text-xs text-amber-800 dark:text-amber-300">
								If you are the sole owner of any organization, that organization
								and all its workspaces will be permanently deleted along with
								your account.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="delete-confirm-email">
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
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={isDeletingAccount}
						>
							Cancel
						</Button>
						<Button
							variant="outline"
							className="border-red-300 bg-red-600 text-white hover:bg-red-700 dark:border-red-800"
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
								"Permanently Delete Account"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
