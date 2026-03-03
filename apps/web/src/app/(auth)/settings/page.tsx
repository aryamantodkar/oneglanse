"use client";

import { downloadCsv, downloadJson } from "@/lib/export/download";
import { buildAnalysisCsvRow } from "@/lib/export/analysisCsvRow";
import { api } from "@/trpc/react";
import {
	PROVIDER_LIST,
	type AnalysisRecord,
	type DomainStats,
	type GroupedSource,
	type Provider,
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
	PROVIDER_DISPLAY,
	getModelFavicon,
	getProviderDisplayName,
	getUniqueModelProviders,
	joinCitedTexts,
} from "@oneglanse/utils";
import {
	CheckCircle2,
	Download,
	Loader2,
	Pencil,
	Settings,
	X,
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLayoutUserEmail } from "../workspace-context";

export default function SettingsPage(){
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

	// Provider settings state
	const [enabledProviders, setEnabledProviders] = useState<Provider[]>([]);
	const [tempProviders, setTempProviders] = useState<Provider[]>([]);
	const [isEditingProviders, setIsEditingProviders] = useState(false);
	const [savingProviders, setSavingProviders] = useState(false);

	// Fetch enabled providers
	const { data: providersData } = api.workspace.getEnabledProviders.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId, refetchOnMount: true },
	);

	// Update mutation for providers
	const updateProvidersMutation = api.workspace.setEnabledProviders.useMutation(
		{
			onSuccess: () => {
				toast.success("Provider settings updated");
			},
			onError: (err) => {
				toast.error(err.message);
			},
		},
	);

	useEffect(() => {
		if (providersData?.enabledProviders) {
			setEnabledProviders(providersData.enabledProviders);
			setTempProviders(providersData.enabledProviders);
		}
	}, [providersData]);

	// Toggle provider handler (for edit mode)
	const handleProviderToggle = (provider: Provider) => {
		const isEnabled = tempProviders.includes(provider);
		const newProviders = isEnabled
			? tempProviders.filter((p) => p !== provider)
			: [...tempProviders, provider];

		if (newProviders.length === 0) {
			toast.error("At least one provider must be enabled");
			return;
		}

		setTempProviders(newProviders);
	};

	// Save provider changes
	const handleSaveProviders = async () => {
		setSavingProviders(true);
		try {
			await updateProvidersMutation.mutateAsync({
				workspaceId,
				providers: tempProviders,
			});
			setEnabledProviders(tempProviders);
			setIsEditingProviders(false);
			toast.success("AI provider settings updated successfully");
		} catch (err) {
			console.error(err);
			toast.error("Failed to update provider settings");
		} finally {
			setSavingProviders(false);
		}
	};

	// Cancel provider editing
	const handleCancelProviders = () => {
		setTempProviders(enabledProviders);
		setIsEditingProviders(false);
	};

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
			toast.error(err instanceof Error ? err.message : "Failed to delete account.");
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

	if (!workspaceId) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<p className="text-sm text-gray-500">No workspace selected.</p>
			</div>
		);
	}

	return (
		<div className="ui-page-enter ui-stagger mx-auto max-w-4xl space-y-8 py-6">
			{/* Page Header */}
			<div className="mb-6 flex items-center gap-2">
                <Settings className="h-6 w-6 shrink-0 text-gray-500" />
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					Settings
				</h1>
			</div>

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
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								className="gap-2"
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
								className="gap-2"
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

			{/* Provider Settings */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						AI Providers
					</h2>
				</div>

				<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
					<div className="mb-3 flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<Settings className="h-4 w-4 text-gray-500" />
							<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
								Active AI Providers
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={() => {
								if (isEditingProviders) {
									handleCancelProviders();
								} else {
									setIsEditingProviders(true);
								}
							}}
							aria-label={
								isEditingProviders
									? "Cancel editing providers"
									: "Edit providers"
							}
						>
							{isEditingProviders ? (
								<X className="h-4 w-4" />
							) : (
								<Pencil className="h-4 w-4" />
							)}
						</Button>
					</div>

					{!isEditingProviders ? (
						// View mode - show selected providers
						<div className="space-y-2">
							<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
								Your prompts will be sent to these AI providers
							</p>
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{PROVIDER_LIST.map((provider) => {
									const isEnabled = enabledProviders.includes(provider);
									return (
										<div
											key={provider}
											className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
												isEnabled
													? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
													: "border-gray-200 bg-gray-50/30 dark:border-gray-800 dark:bg-gray-900/30 opacity-40"
											}`}
										>
											{isEnabled ? (
												<CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
											) : (
												<div className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
											)}
											<img
												src={getModelFavicon(provider)}
												alt={getProviderDisplayName(provider)}
												className="h-5 w-5 shrink-0 rounded-sm"
											/>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
													{getProviderDisplayName(provider)}
												</p>
												<p className="truncate text-xs text-gray-500 dark:text-gray-400">
													{PROVIDER_DISPLAY[provider].description}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						// Edit mode - allow selection
						<div className="space-y-3">
							<p className="text-xs text-gray-500 dark:text-gray-400">
								Select which AI providers to query for prompts (at least one
								required)
							</p>
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{PROVIDER_LIST.map((provider) => {
									const isSelected = tempProviders.includes(provider);
									return (
										<button
											key={provider}
											type="button"
											onClick={() => handleProviderToggle(provider)}
											className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
												isSelected
													? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-200 dark:border-blue-700 dark:bg-blue-950/20 dark:ring-blue-800"
													: "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
											}`}
										>
											{isSelected ? (
												<CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
											) : (
												<div className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-700" />
											)}
											<img
												src={getModelFavicon(provider)}
												alt={getProviderDisplayName(provider)}
												className="h-5 w-5 shrink-0 rounded-sm"
											/>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
													{getProviderDisplayName(provider)}
												</p>
												<p className="truncate text-xs text-gray-500 dark:text-gray-400">
													{PROVIDER_DISPLAY[provider].description}
												</p>
											</div>
										</button>
									);
								})}
							</div>

							{tempProviders.length === 0 && (
								<p className="text-xs text-red-600 dark:text-red-400">
									At least one provider must be enabled
								</p>
							)}

							<div className="flex justify-end gap-2 pt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleCancelProviders}
									disabled={savingProviders}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleSaveProviders}
									disabled={savingProviders || tempProviders.length === 0}
									className="gap-2"
								>
									{savingProviders && (
										<Loader2 className="h-4 w-4 animate-spin" />
									)}
									Save Changes
								</Button>
							</div>
						</div>
					)}
				</div>
			</section>

			{/* Danger Zone */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<h2 className="text-lg font-semibold text-red-600 dark:text-red-500">
						Account
					</h2>
				</div>
				<div className="rounded-lg border border-red-200 p-4 dark:border-red-900/50">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
								Delete Account
							</p>
							<p className="mt-1 text-xs text-gray-500">
								Permanently delete your account, all your workspaces, and all associated data. This cannot be undone.
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
							This action is permanent and cannot be undone. All your workspaces, prompts, and data will be permanently deleted.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/20">
							<p className="text-xs text-amber-800 dark:text-amber-300">
								If you are the sole owner of any organization, that organization and all its workspaces will be permanently deleted along with your account.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="delete-confirm-email">
								Type your email <span className="font-mono text-xs text-gray-500">({userEmail})</span> to confirm
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
								deleteConfirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()
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
