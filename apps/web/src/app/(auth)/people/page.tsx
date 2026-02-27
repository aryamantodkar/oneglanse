"use client";

import { downloadCsv, downloadJson } from "@/lib/export/download";
import { api } from "@/trpc/react";
import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import {
	Button,
	Input,
	Label,
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
	toast,
} from "@oneglanse/ui";
import { PROVIDER_DISPLAY, getModelFavicon, getProviderDisplayName } from "@oneglanse/utils";
import {
	Building2,
	CheckCircle2,
	Download,
	Loader2,
	Pencil,
	Plus,
	Settings,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface WorkspaceMember {
	memberId: string;
	userId: string;
	role: string;
	joinedAt: Date;
	userName: string;
	userEmail: string;
	userImage: string | null;
}

export default function PeoplePage(): React.JSX.Element {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const utils = api.useUtils();

	// Workspace members state
	const [wsInviteEmail, setWsInviteEmail] = useState("");
	const [wsInviteRole, setWsInviteRole] = useState("member");
	const [wsAdding, setWsAdding] = useState(false);

	// Workspace members via tRPC
	const wsMembersQuery = api.workspace.listMembers.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const workspaceQuery = api.workspace.getById.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const wsMembers = (wsMembersQuery.data ?? []) as WorkspaceMember[];
	const joinInfoQuery = api.workspace.getJoinInfo.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const joinInfo = joinInfoQuery.data;
	const joinInfoLoading = joinInfoQuery.isLoading;
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

	const addWsMemberMutation = api.workspace.addMember.useMutation();
	const removeWsMemberMutation = api.workspace.removeMember.useMutation();
	const updateWorkspaceMutation = api.workspace.updateDetails.useMutation();
	const updateOrgMutation = api.workspace.updateOrganizationName.useMutation();

	const [workspaceName, setWorkspaceName] = useState("");
	const [workspaceDomain, setWorkspaceDomain] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [savingWorkspace, setSavingWorkspace] = useState(false);
	const [savingOrg, setSavingOrg] = useState(false);
	const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
	const [isEditingOrg, setIsEditingOrg] = useState(false);

	// Provider settings state
	const [enabledProviders, setEnabledProviders] = useState<Provider[]>([]);
	const [tempProviders, setTempProviders] = useState<Provider[]>([]);
	const [isEditingProviders, setIsEditingProviders] = useState(false);
	const [savingProviders, setSavingProviders] = useState(false);

	const workspace = workspaceQuery.data;
	const organization = joinInfo?.organization;

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

	useEffect(() => {
		setWorkspaceName(workspace?.name ?? "");
		setWorkspaceDomain(workspace?.domain ?? "");
	}, [workspace?.name, workspace?.domain]);

	useEffect(() => {
		setOrganizationName(organization?.name ?? "");
	}, [organization?.name]);

	const normalizedWorkspaceName = workspaceName.trim();
	const normalizedWorkspaceDomain = workspaceDomain.trim();
	const normalizedOrganizationName = organizationName.trim();
	const workspaceDetailsChanged =
		normalizedWorkspaceName !== (workspace?.name ?? "").trim() ||
		normalizedWorkspaceDomain !== (workspace?.domain ?? "").trim();
	const organizationNameChanged =
		normalizedOrganizationName !== (organization?.name ?? "").trim();

	const handleCopy = async (value: string, label: string) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied to clipboard.`);
		} catch (err) {
			console.error(err);
			toast.error("Failed to copy to clipboard.");
		}
	};

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

	// Workspace add member handler
	const handleWsAddMember = async () => {
		if (!wsInviteEmail.trim()) {
			toast.error("Please enter an email address.");
			return;
		}

		setWsAdding(true);
		try {
			const result = await addWsMemberMutation.mutateAsync({
				workspaceId,
				email: wsInviteEmail.trim(),
				role: wsInviteRole as "owner" | "member",
			});

			if (result?.status === "not-found") {
				toast.error(
					"User not found. Share your workspace code so they can join after signing up.",
				);
				setWsInviteEmail("");
				return;
			}

			if (result?.status === "already-member") {
				toast.success("This user is already a workspace member.");
				setWsInviteEmail("");
				return;
			}

			toast.success("Member added to workspace!");
			setWsInviteEmail("");
			await wsMembersQuery.refetch();
		} catch (err) {
			console.error(err);
			toast.error("Failed to add member to workspace.");
		} finally {
			setWsAdding(false);
		}
	};

	// Workspace remove member handler
	const handleWsRemoveMember = async (userId: string, role: string) => {
		try {
			const result = await removeWsMemberMutation.mutateAsync({
				workspaceId,
				userId,
				role,
			});

			toast.success("Member removed from workspace.");
			await wsMembersQuery.refetch();
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "Failed to remove member.");
		}
	};

	const handleSaveWorkspaceDetails = async () => {
		if (!workspaceName.trim() || !workspaceDomain.trim()) {
			toast.error("Please enter both brand name and brand domain.");
			return;
		}
		if (!workspaceDetailsChanged) return;

		const nextName = workspaceName.trim();
		const nextDomain = workspaceDomain.trim();
		const brandChanged =
			(workspace?.name ?? "").trim() !== nextName ||
			(workspace?.domain ?? "").trim() !== nextDomain;

		if (brandChanged) {
			const confirmed = window.confirm(
				"Changing brand details will erase all analyzed data for this workspace and require re-analysis. Prompt responses will remain intact. Continue?",
			);
			if (!confirmed) return;
		}

		setSavingWorkspace(true);
		try {
			const result = await updateWorkspaceMutation.mutateAsync({
				workspaceId,
				name: nextName,
				domain: nextDomain,
			});

			if ((result as any)?.analysisReset) {
				toast.success(
					"Brand details updated. Previous analysis was cleared and will be regenerated on next analysis run.",
				);
			} else {
				toast.success("Workspace details updated.");
			}
			await workspaceQuery.refetch();
			await joinInfoQuery.refetch();
			await utils.workspace.listAllForUser.invalidate();
			await utils.workspace.getById.invalidate({ workspaceId });
			await utils.workspace.getJoinInfo.invalidate({ workspaceId });
			setIsEditingWorkspace(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update workspace details.");
		} finally {
			setSavingWorkspace(false);
		}
	};

	const handleSaveOrganizationName = async () => {
		if (!organizationName.trim()) {
			toast.error("Please enter an organization name.");
			return;
		}
		if (!organizationNameChanged) return;

		setSavingOrg(true);
		try {
			const result = await updateOrgMutation.mutateAsync({
				workspaceId,
				organizationName: organizationName.trim(),
			});

			toast.success("Organization name updated.");
			await joinInfoQuery.refetch();
			await utils.workspace.listAllForUser.invalidate();
			await utils.workspace.getJoinInfo.invalidate({ workspaceId });
			setIsEditingOrg(false);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Only workspace owners can update organization name.",
			);
		} finally {
			setSavingOrg(false);
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

		const citationRows = combinedSources.flatMap((source: any) =>
			(source.excerpts ?? []).map((excerpt: any) => ({
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
			workspace: workspace ?? null,
			organization: organization ?? null,
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
					(count: number, source: any) =>
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
			...analysisData.map((record: any) => ({
				section: "analysis_metrics",
				prompt_id: record.prompt_id,
				prompt: record.prompt,
				model: record.model_provider,
				prompt_run_at: record.prompt_run_at,
				geo_score: record.brand_analysis?.geoScore?.overall ?? "",
				sentiment: record.brand_analysis?.sentiment?.score ?? "",
				visibility: record.brand_analysis?.presence?.visibility ?? "",
				position: record.brand_analysis?.position?.rankPosition ?? "",
				recommendation: record.brand_analysis?.recommendation?.type ?? "",
				citations: record.sources?.length ?? 0,
				source_urls: (record.sources ?? [])
					.map((source: any) => source.url)
					.filter(Boolean)
					.join(" | "),
				cited_texts: (record.sources ?? [])
					.map((source: any) => source.cited_text)
					.filter(Boolean)
					.join(" | "),
			})),
			...domainStats.map((domain: any) => ({
				section: "source_domain_performance",
				domain: domain.domain,
				total_sources: domain.total_sources ?? domain.totalSources ?? 0,
				percentage: domain.percentage ?? "",
			})),
			...combinedSources.map((source: any) => ({
				section: "source_url_performance",
				url: source.url,
				title: source.title,
				total_citations: source.totalSources ?? 0,
				models: [
					...new Set(
						(source.excerpts ?? [])
							.map((e: any) => e.model_provider)
							.filter(Boolean),
					),
				].join(", "),
				cited_texts: (source.excerpts ?? [])
					.map((e: any) => e.cited_text)
					.filter(Boolean)
					.join(" | "),
			})),
			...combinedSources.flatMap((source: any) =>
				(source.excerpts ?? []).map((excerpt: any) => ({
					section: "source_excerpts",
					url: source.url,
					title: source.title,
					model: excerpt.model_provider ?? "",
					cited_text: excerpt.cited_text ?? "",
				})),
			),
			...analysisData.flatMap((record: any) =>
				(record.sources ?? []).map((source: any) => ({
					section: "analysis_sources",
					prompt_id: record.prompt_id,
					model: record.model_provider,
					source_title: source.title ?? "",
					source_url: source.url ?? "",
					source_domain: source.domain ?? "",
					source_cited_text: source.cited_text ?? "",
				})),
			),
			...analysisData.map((record: any) => ({
				section: "analysis_full_json",
				prompt_id: record.prompt_id,
				model: record.model_provider,
				brand_analysis_json: JSON.stringify(record.brand_analysis ?? {}),
			})),
		];

		downloadCsv(`workspace-all-${workspaceId}-${Date.now()}.csv`, rows);
	};

	const getRoleBadgeClass = (role: string) => {
		switch (role) {
			case "owner":
				return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
			case "admin":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
			default:
				return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
		}
	};

	if (!workspaceId) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<p className="text-sm text-gray-500">No workspace selected.</p>
			</div>
		);
	}

	if (wsMembersQuery.isError) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<p className="text-sm text-gray-500">
					Unable to load workspace members.
				</p>
			</div>
		);
	}

	return (
		<div className="ui-page-enter ui-stagger mx-auto max-w-4xl space-y-8 py-6">
			{/* Page Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					Preferences
				</h1>
			</div>

			{/* Provider Settings */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<Settings className="h-5 w-5 text-gray-500" />
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						AI Provider Settings
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

			<section>
				<div className="mb-4 flex items-center gap-2">
					<Settings className="h-5 w-5 text-gray-500" />
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Workspace Settings
					</h2>
				</div>

				<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
					<div className="flex h-full flex-col rounded-lg border border-gray-200 p-4 dark:border-gray-800">
						<div className="mb-3 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Users className="h-4 w-4 text-gray-500" />
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Brand Workspace
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => {
									if (isEditingWorkspace) {
										setWorkspaceName(workspace?.name ?? "");
										setWorkspaceDomain(workspace?.domain ?? "");
										setIsEditingWorkspace(false);
										return;
									}
									setIsEditingWorkspace(true);
								}}
								aria-label={
									isEditingWorkspace
										? "Cancel editing workspace"
										: "Edit workspace"
								}
							>
								{isEditingWorkspace ? (
									<X className="h-4 w-4" />
								) : (
									<Pencil className="h-4 w-4" />
								)}
							</Button>
						</div>
						<div className="space-y-2">
							<Label htmlFor="settings-workspace-name">Brand Name</Label>
							<Input
								id="settings-workspace-name"
								value={workspaceName}
								onChange={(e) => setWorkspaceName(e.target.value)}
								placeholder="e.g. Pipedrive"
								disabled={!isEditingWorkspace}
							/>
						</div>
						<div className="mt-3 space-y-2">
							<Label htmlFor="settings-workspace-domain">Brand Domain</Label>
							<Input
								id="settings-workspace-domain"
								value={workspaceDomain}
								onChange={(e) => setWorkspaceDomain(e.target.value)}
								placeholder="e.g. pipedrive.com"
								disabled={!isEditingWorkspace}
							/>
							<p className="text-xs text-gray-500">
								Used to track your brand visibility and citations in AI
								responses.
							</p>
							{isEditingWorkspace && (
								<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/20">
									<p className="text-xs text-amber-800 dark:text-amber-300">
										Warning: Changing brand details clears all analyzed data in
										this workspace. Raw prompt responses are not deleted.
									</p>
								</div>
							)}
						</div>

						<div className="mt-auto flex items-center justify-end gap-2 pt-4">
							{isEditingWorkspace && (
								<>
									<Button
										variant="outline"
										className="w-28"
										onClick={() => {
											setWorkspaceName(workspace?.name ?? "");
											setWorkspaceDomain(workspace?.domain ?? "");
											setIsEditingWorkspace(false);
										}}
										disabled={savingWorkspace}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveWorkspaceDetails}
										disabled={
											savingWorkspace ||
											!workspaceName.trim() ||
											!workspaceDomain.trim() ||
											!workspaceDetailsChanged
										}
										className="w-28"
									>
										{savingWorkspace ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</>
							)}
						</div>
					</div>

					<div className="flex h-full flex-col rounded-lg border border-gray-200 p-4 dark:border-gray-800">
						<div className="mb-3 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Building2 className="h-4 w-4 text-gray-500" />
								<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
									Organization
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => {
									if (isEditingOrg) {
										setOrganizationName(organization?.name ?? "");
										setIsEditingOrg(false);
										return;
									}
									setIsEditingOrg(true);
								}}
								aria-label={
									isEditingOrg
										? "Cancel editing organization"
										: "Edit organization"
								}
							>
								{isEditingOrg ? (
									<X className="h-4 w-4" />
								) : (
									<Pencil className="h-4 w-4" />
								)}
							</Button>
						</div>
						<div className="space-y-2">
							<Label htmlFor="settings-org-name">Organization Name</Label>
							<Input
								id="settings-org-name"
								value={organizationName}
								onChange={(e) => setOrganizationName(e.target.value)}
								placeholder="Enter organization name"
								disabled={!isEditingOrg}
							/>
							<p className="text-xs text-gray-500">
								Only workspace owners can rename the organization.
							</p>
						</div>

						<div className="mt-auto flex items-center justify-end gap-2 pt-4">
							{isEditingOrg && (
								<>
									<Button
										variant="outline"
										className="w-28"
										onClick={() => {
											setOrganizationName(organization?.name ?? "");
											setIsEditingOrg(false);
										}}
										disabled={savingOrg}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveOrganizationName}
										disabled={
											savingOrg ||
											!organizationName.trim() ||
											!organizationNameChanged
										}
										className="w-28"
									>
										{savingOrg ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</>
							)}
						</div>
					</div>
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
									sourcesQuery.isLoading
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
									sourcesQuery.isLoading
								}
							>
								<Download className="h-4 w-4" />
								Export All CSV
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Workspace Members Section */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<Users className="h-5 w-5 text-gray-500" />
					<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Workspace Members
					</h2>
				</div>

				{/* Join codes */}
				<div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
					<div>
						<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
							Invite with a code
						</p>
						<p className="text-xs text-gray-500">
							Share the workspace code to let teammates join instantly.
						</p>
						{joinInfo?.organization?.name && (
							<p className="mt-1 text-xs text-gray-500">
								Organization:{" "}
								<span className="font-medium text-gray-700 dark:text-gray-300">
									{joinInfo.organization.name}
								</span>
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						{joinInfoLoading ? (
							<>
								<Skeleton className="h-9 w-[260px]" />
								<Skeleton className="h-9 w-16" />
							</>
						) : (
							<>
								<Input
									readOnly
									value={joinInfo?.workspaceCode ?? ""}
									placeholder="Workspace code"
									className="max-w-md"
								/>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										handleCopy(joinInfo?.workspaceCode ?? "", "Workspace code")
									}
									disabled={!joinInfo?.workspaceCode}
								>
									Copy
								</Button>
							</>
						)}
					</div>
				</div>

				{/* Add member form */}
				<div className="mb-4 flex items-center gap-2">
					<Input
						placeholder="Email address (we'll invite if needed)"
						value={wsInviteEmail}
						onChange={(e) => setWsInviteEmail(e.target.value)}
						className="max-w-xs"
						onKeyDown={(e) => e.key === "Enter" && handleWsAddMember()}
					/>
					<Select value={wsInviteRole} onValueChange={setWsInviteRole}>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="member">Member</SelectItem>
							<SelectItem value="owner">Owner</SelectItem>
						</SelectContent>
					</Select>
					<Button
						onClick={handleWsAddMember}
						disabled={wsAdding || !wsInviteEmail.trim()}
						size="sm"
						className="gap-2"
					>
						{wsAdding ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								<Plus className="h-4 w-4" />
								Add
							</>
						)}
					</Button>
				</div>

				{/* Workspace members table */}
				{wsMembersQuery.isLoading ? (
					<div className="space-y-3 py-6">
						{Array.from({ length: 4 }).map((_, idx) => (
							<div
								key={`ws-member-skeleton-${idx}`}
								className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
							>
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-40" />
								</div>
								<Skeleton className="h-6 w-16 rounded-full" />
							</div>
						))}
					</div>
				) : (
					<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
						<Table>
							<TableHeader>
								<TableRow className="bg-gray-50/70 dark:bg-gray-900/40">
									<TableHead className="px-4 py-3">Name</TableHead>
									<TableHead className="px-4 py-3">Email</TableHead>
									<TableHead className="px-4 py-3">Role</TableHead>
									<TableHead className="px-4 py-3 w-20" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{wsMembers.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={4}
											className="py-8 text-center text-sm text-gray-500"
										>
											No workspace members yet.
										</TableCell>
									</TableRow>
								) : (
									wsMembers.map((member) => (
										<TableRow key={member.memberId}>
											<TableCell className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
												{member.userName}
											</TableCell>
											<TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
												{member.userEmail}
											</TableCell>
											<TableCell className="px-4 py-3">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeClass(member.role)}`}
												>
													{member.role}
												</span>
											</TableCell>
											<TableCell className="px-4 py-3">
												{member.role !== "owner" && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															handleWsRemoveMember(member.userId, member.role)
														}
														className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
		</div>
	);
}
