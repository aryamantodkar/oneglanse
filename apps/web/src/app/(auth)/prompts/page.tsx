"use client";

import { ExportMenu } from "@/components/export-menu";
import {
	formDialogBodyClassName,
	formDialogContentClassName,
	formDialogFieldGroupClassName,
	formDialogHeaderClassName,
	formDialogScrollBodyClassName,
	formDialogStickyTopClassName,
	formDialogSupportCardClassName,
	formHintClassName,
	formLabelClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formResponseMetricsPanelClassName,
	formResponsePreviewCardClassName,
	formSecondaryButtonClassName,
	formSectionDescriptionClassName,
	formSectionTitleClassName,
	formSubtleActionClassName,
	formTextareaClassName,
	formToolbarButtonClassName,
	formToolbarGhostButtonClassName,
	formToolbarSelectClassName,
} from "@/components/forms/auth-form-chrome";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type { AnalysisRecord, UserPrompt } from "@oneglanse/types";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	EmptyStatePanel,
	ProviderModelSelect,
	Separator,
	Skeleton,
	SortableHeader,
	SourcesHoverLinks,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TemporaryIssueState,
	Textarea,
	TimeRangeSelect,
	WorkspaceRequiredState,
	toast,
	useSortState,
} from "@oneglanse/ui";
import { PositionMetricCell, SentimentMetricCell } from "@oneglanse/ui";
import {
	filterAnalysisRecords,
	formatDate,
	formatMarkdown,
	getModelFavicon,
	joinCitedTexts,
	joinSourceUrls,
	modelSelectors,
} from "@oneglanse/utils";
import { cn } from "@oneglanse/utils";
import { Bot, ChevronDown, FilterX, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStorePrompt } from "./_lib/mutations/prompt.mutations";
import {
	useFetchAnalysedPrompts,
	useUserPrompts,
} from "./_lib/queries/prompt.queries";

type SortColumn =
	| "prompt"
	| "geoScore"
	| "sentiment"
	| "visibility"
	| "position";

export default function Prompts() {
	const searchParams = useSafeSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";
	const { data: workspace } = api.workspace.getById.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);

	const [initialPrompts, setInitialPrompts] = useState<UserPrompt[]>([]);
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">(
		"all",
	);
	const {
		sortColumn: sortBy,
		sortDirection,
		toggleSort: handleColumnSort,
		resetSort: resetColumnSort,
	} = useSortState<SortColumn>("prompt", "asc");
	const [currentPrompt, setCurrentPrompt] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
	const [loading, setLoading] = useState(false);
	const [promptData, setPromptData] = useState<UserPrompt[]>([]);
	const [openPrompt, setOpenPrompt] = useState<null | (typeof promptData)[0]>(
		null,
	);
	const [editIndex, setEditIndex] = useState<number | null>(null);
	const [editPromptValue, setEditPromptValue] = useState("");
	const [expandedResponses, setExpandedResponses] = useState<Set<number>>(
		new Set(),
	);
	const [promptResponsesScrolled, setPromptResponsesScrolled] = useState(false);
	const [analysisRecords, setAnalysisRecords] = useState<AnalysisRecord[]>([]);

	const {
		data: userPrompts,
		isLoading: isUserPromptsLoading,
		error: userPromptsError,
	} = useUserPrompts(workspaceId);

	const {
		data: analysedPromptData,
		isLoading: isAnalysedPromptsLoading,
		error: analysedPromptError,
	} = useFetchAnalysedPrompts(workspaceId);

	const promptExampleBrand =
		workspace?.name?.trim() ||
		"What's the best project management software for a small remote team?";

	const storePromptMutation = useStorePrompt();

	useEffect(() => {
		if (userPrompts?.length) {
			setPromptData(userPrompts);
			setInitialPrompts(userPrompts);
		}
	}, [userPrompts]);

	useEffect(() => {
		if (!analysedPromptData) return;

		const records = analysedPromptData;

		setAnalysisRecords(records);
	}, [analysedPromptData]);

	const filteredRecords = useMemo(() => {
		return filterAnalysisRecords(analysisRecords, {
			modelFilter,
			timeFilter,
		});
	}, [analysisRecords, modelFilter, timeFilter]);

	// Calculate metrics for each prompt based on model filter
	const promptsWithMetrics = useMemo(() => {
		const isDefaultAnalysis = (
			ba: NonNullable<AnalysisRecord["brand_analysis"]>,
		) =>
			ba.geoScore.overall === 0 &&
			ba.sentiment.score === 50 &&
			ba.presence.visibility === 0 &&
			ba.position.rankPosition === null;

		return promptData.map((prompt, sourceIndex) => {
			const records = filteredRecords.filter((r) => r.prompt_id === prompt.id);

			if (records.length === 0) {
				return {
					sourceIndex,
					prompt,
					metrics: null,
					recordCount: 0,
					modelProvider: null,
					reason: "no-responses" as const,
				};
			}

			// If a specific model is selected, use that model's metrics
			if (modelFilter !== "All Models") {
				const record = records.find((r) => r.model_provider === modelFilter);
				if (!record) {
					return {
						sourceIndex,
						prompt,
						metrics: null,
						recordCount: records.length,
						modelProvider: modelFilter,
						reason: "no-responses" as const,
					};
				}

				// If response exists but not analyzed, show as unanalyzed
				if (!record.is_analysed) {
					return {
						sourceIndex,
						prompt,
						metrics: null,
						recordCount: records.length,
						modelProvider: modelFilter,
						reason: "unanalyzed" as const,
					};
				}

				const ba = record.brand_analysis;
				if (!ba) {
					return {
						sourceIndex,
						prompt,
						metrics: null,
						recordCount: records.length,
						modelProvider: record.model_provider,
						reason: "brand-not-mentioned" as const,
					};
				}

				if (isDefaultAnalysis(ba)) {
					return {
						sourceIndex,
						prompt,
						metrics: null,
						recordCount: records.length,
						modelProvider: record.model_provider,
						reason: "brand-not-mentioned" as const,
					};
				}

				const metrics = {
					geoScore: ba.geoScore.overall,
					mentionCount: ba.presence.mentionCount,
					sentiment: ba.sentiment.score,
					visibility: ba.presence.visibility,
					position: ba.position.rankPosition,
				};

				return {
					sourceIndex,
					prompt,
					metrics,
					recordCount: records.length,
					modelProvider: record.model_provider,
					reason: null,
				};
			}

			// "All Models" selected - calculate average metrics across all analyzed records
			const analyzedRecords = records.filter((r) => r.is_analysed);

			// If we have responses but none are analyzed yet
			if (analyzedRecords.length === 0) {
				return {
					sourceIndex,
					prompt,
					metrics: null,
					recordCount: records.length,
					modelProvider: "All Models",
					reason: "unanalyzed" as const,
				};
			}

			// Aggregate brand analysis from all analyzed records
			const allAnalyses = analyzedRecords
				.map((record) => record.brand_analysis)
				.filter((ba): ba is NonNullable<typeof ba> => !!ba);

			// Skip default-only analyses when calculating averages
			const validAnalyses = allAnalyses.filter((ba) => !isDefaultAnalysis(ba));

			if (validAnalyses.length === 0) {
				return {
					sourceIndex,
					prompt,
					metrics: null,
					recordCount: records.length,
					modelProvider: "All Models",
					reason: "brand-not-mentioned" as const,
				};
			}

			// Calculate averages
			const positionsWithValues = allAnalyses
				.filter((ba) => !isDefaultAnalysis(ba))
				.filter((ba) => ba.position.rankPosition !== null)
				.map((ba) => ba.position.rankPosition as number);
			const avgMetrics = {
				geoScore: Math.round(
					validAnalyses.reduce((sum, ba) => sum + ba.geoScore.overall, 0) /
						validAnalyses.length,
				),
				mentionCount: Math.round(
					validAnalyses.reduce((sum, ba) => sum + ba.presence.mentionCount, 0) /
						validAnalyses.length,
				),
				sentiment: Math.round(
					validAnalyses.reduce((sum, ba) => sum + ba.sentiment.score, 0) /
						validAnalyses.length,
				),
				visibility: Math.round(
					validAnalyses.reduce((sum, ba) => sum + ba.presence.visibility, 0) /
						validAnalyses.length,
				),
				position:
					positionsWithValues.length > 0
						? Math.round(
								positionsWithValues.reduce((sum, p) => sum + p, 0) /
									positionsWithValues.length,
							)
						: null,
			};

			return {
				sourceIndex,
				prompt,
				metrics: avgMetrics,
				recordCount: records.length,
				modelProvider: "All Models",
				reason: null,
			};
		});
	}, [promptData, filteredRecords, modelFilter]);

	const sortedPromptsWithMetrics = useMemo(() => {
		const rows = [...promptsWithMetrics];
		if (sortBy === null) return rows;
		const direction = sortDirection === "asc" ? 1 : -1;

		rows.sort((a, b) => {
			if (sortBy === "prompt") {
				return direction * a.prompt.prompt.localeCompare(b.prompt.prompt);
			}

			const aValue =
				sortBy === "position"
					? (a.metrics?.position ?? null)
					: (a.metrics?.[sortBy] ?? null);
			const bValue =
				sortBy === "position"
					? (b.metrics?.position ?? null)
					: (b.metrics?.[sortBy] ?? null);

			// Keep rows without metrics at the bottom regardless of direction
			if (aValue === null && bValue !== null) return 1;
			if (aValue !== null && bValue === null) return -1;
			if (aValue === null && bValue === null) {
				return a.prompt.prompt.localeCompare(b.prompt.prompt);
			}

			if ((aValue as number) === (bValue as number)) {
				return a.prompt.prompt.localeCompare(b.prompt.prompt);
			}

			return direction * ((aValue as number) - (bValue as number));
		});

		return rows;
	}, [promptsWithMetrics, sortBy, sortDirection]);

	const hasExportableData = filteredRecords.length > 0;

	const openPromptRecords = useMemo(() => {
		if (!openPrompt) return [];
		// Filter responses for this prompt using current filters
		return filteredRecords.filter(
			(record) => record.prompt_id === openPrompt.id,
		);
	}, [openPrompt, filteredRecords]);

	const isModified = useMemo(() => {
		if (promptData.length !== initialPrompts.length) return true;
		return promptData.some((p, i) => {
			const original = initialPrompts[i];
			if (!original) return true;
			return p.prompt.trim() !== original.prompt.trim();
		});
	}, [promptData, initialPrompts]);

	const isEditPromptChanged =
		editIndex !== null &&
		editPromptValue.trim() !== (promptData[editIndex]?.prompt ?? "").trim();

	const handleAddOrEditPrompt = () => {
		if (editIndex !== null) {
			if (!isEditPromptChanged) {
				setEditIndex(null);
				setEditPromptValue("");
				setDialogOpen(false);
				return;
			}

			setPromptData((prev) =>
				prev.map((p, i) =>
					i === editIndex ? { ...p, prompt: editPromptValue.trim() } : p,
				),
			);
			setEditIndex(null);
			setEditPromptValue("");
			setDialogOpen(false);
		} else {
			if (!currentPrompt.trim()) return;

			setPromptData([
				...promptData,
				{
					id: crypto.randomUUID(),
					created_at: new Date().toISOString(),
					user_id: "",
					workspace_id: workspaceId ?? "",
					prompt: currentPrompt.trim(),
				},
			]);

			setCurrentPrompt("");
			setDialogOpen(false);
		}
	};

	const toggleRow = (idx: number) => {
		setSelectedRows((prev) => {
			const newSet = new Set(prev);
			newSet.has(idx) ? newSet.delete(idx) : newSet.add(idx);
			return newSet;
		});
	};

	const handleSave = async () => {
		if (!workspaceId) return toast.error("Workspace ID is undefined.");

		setLoading(true);
		try {
			const prompts = promptData.map((p) => p.prompt);
			await storePromptMutation.mutateAsync({ prompts, workspaceId });
			setInitialPrompts(promptData);
			toast.success("Prompts saved successfully!");
		} catch (err) {
			console.error(err);
			toast.error("Failed to save prompts");
		} finally {
			setLoading(false);
		}
	};

	const toggleResponse = (index: number) => {
		setExpandedResponses((prev) => {
			const next = new Set(prev);
			next.has(index) ? next.delete(index) : next.add(index);
			return next;
		});
	};

	const LoadingState = () => (
		<EmptyStatePanel
			icon={Bot}
			eyebrow="Loading"
			title="Loading Prompts"
			description="Pulling your prompt library into place."
			contentClassName="max-w-sm px-6 py-7"
		/>
	);

	if (!workspaceId) {
		return (
			<WorkspaceRequiredState
				icon={Bot}
				title="Pick a Workspace"
				description="Open a workspace to add and track prompts."
			/>
		);
	}

	if (userPromptsError || analysedPromptError) {
		return (
			<TemporaryIssueState
				icon={FilterX}
				title="Prompts Are Unavailable"
				description="We couldn’t load your prompts right now."
			/>
		);
	}

	if (isUserPromptsLoading || isAnalysedPromptsLoading) {
		return (
			<div className="flex min-h-svh flex-col">
				<div className="flex items-center justify-between px-4 py-4 sm:px-6">
					<Skeleton className="h-8 w-24 rounded-lg" />
					<Skeleton className="h-9 w-28 rounded-xl" />
				</div>

				<LoadingState />
			</div>
		);
	}

	return (
		<div className="ui-page-enter ui-stagger flex min-h-full flex-col">
			<div className="px-4 py-4 sm:px-6 sm:py-6">
				{/* Single Row: Actions + Filters */}
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					{/* Left: Prompt actions */}
					<div className="flex flex-wrap items-center gap-2">
						{selectedRows.size === 0 ? (
							<Dialog
								open={dialogOpen}
								onOpenChange={(open) => {
									setDialogOpen(open);

									if (!open) {
										setEditIndex(null);
										setEditPromptValue("");
										setCurrentPrompt("");
									}
								}}
							>
								<DialogTrigger asChild>
									<Button
										variant="outline"
										className={cn(formToolbarButtonClassName, "gap-2")}
									>
										<Plus size={16} />
										<span>Add Prompt</span>
									</Button>
								</DialogTrigger>
								<DialogContent
									className={cn(formDialogContentClassName, "max-w-xl")}
								>
									<DialogHeader className={formDialogHeaderClassName}>
										<DialogTitle>
											{editIndex !== null ? "Edit Prompt" : "Add New Prompt"}
										</DialogTitle>
									</DialogHeader>
									<div className={formDialogBodyClassName}>
										<div className={formDialogFieldGroupClassName}>
											<div className="space-y-1">
												<p className={formLabelClassName}>Prompt</p>
												<p className={formHintClassName}>
													Write the exact search-style question you want AI
													providers to answer.
												</p>
											</div>
											<Textarea
												placeholder={promptExampleBrand}
												rows={5}
												value={
													editIndex !== null ? editPromptValue : currentPrompt
												}
												onChange={(e) =>
													editIndex !== null
														? setEditPromptValue(e.target.value)
														: setCurrentPrompt(e.target.value)
												}
												className={cn(
													formTextareaClassName,
													"resize-none shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_36px_-22px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.16),0_18px_40px_-24px_rgba(0,0,0,0.46)]",
												)}
											/>
										</div>

										<div className={formDialogSupportCardClassName}>
											<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
												Strong Prompts Usually
											</p>
											<p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
												name the target audience, the use case, and the decision
												they are making, such as choosing alternatives,
												comparing tools, or finding the best fit.
											</p>
										</div>
									</div>
									<div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
										<Button
											variant="outline"
											className={cn(
												formSecondaryButtonClassName,
												"w-full sm:w-auto",
											)}
											onClick={() => setDialogOpen(false)}
										>
											Cancel
										</Button>
										<Button
											onClick={handleAddOrEditPrompt}
											disabled={
												editIndex !== null
													? !isEditPromptChanged
													: !currentPrompt.trim()
											}
											className={cn(
												formPrimaryButtonClassName,
												"w-full sm:w-auto",
											)}
										>
											{editIndex !== null ? "Update" : "Add"}
										</Button>
									</div>
								</DialogContent>
							</Dialog>
						) : (
							<>
								<Button
									variant="outline"
									disabled={selectedRows.size !== 1}
									onClick={() => {
										const idx = Array.from(selectedRows)[0];

										if (
											typeof idx === "number" &&
											idx >= 0 &&
											idx < promptData.length
										) {
											setEditIndex(idx);
											setEditPromptValue(promptData[idx]?.prompt ?? "");
										} else {
											setEditIndex(null);
											setEditPromptValue("");
										}

										setDialogOpen(true);
									}}
									className={cn(formToolbarButtonClassName, "gap-2")}
								>
									<Pencil size={16} />
									<span>Edit</span>
								</Button>
								<Button
									variant="outline"
									className={cn(
										formToolbarButtonClassName,
										"gap-2 border-red-200/80 bg-red-50/80 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50",
									)}
									onClick={() => {
										setPromptData((prev) =>
											prev.filter((_, i) => !selectedRows.has(i)),
										);
										setSelectedRows(new Set());
									}}
								>
									<Trash2 size={16} />
									<span>Delete ({selectedRows.size})</span>
								</Button>
							</>
						)}
					</div>

					{/* Middle: Filters */}
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:w-auto">
						{/* Model filter */}
						<ProviderModelSelect
							value={modelFilter}
							onValueChange={setModelFilter}
							triggerClassName={cn(
								formToolbarSelectClassName,
								"w-full sm:w-auto",
							)}
							contentClassName="z-[9999]"
						/>

						{/* Time filter */}
						<TimeRangeSelect
							value={timeFilter}
							onValueChange={setTimeFilter}
							triggerClassName={cn(
								formToolbarSelectClassName,
								"w-full sm:w-auto",
							)}
						/>

						{/* Clear filters button */}
						{(modelFilter !== "All Models" || timeFilter !== "all") && (
							<>
								<Separator
									orientation="vertical"
									className="hidden h-4 sm:block"
								/>
								<Button
									variant="ghost"
									onClick={() => {
										setModelFilter("All Models");
										setTimeFilter("all");
									}}
									className={cn(formToolbarGhostButtonClassName, "gap-2")}
								>
									<FilterX size={14} />
									Clear
								</Button>
							</>
						)}
					</div>

					{/* Right: Save action */}
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
						<ExportMenu
							className="w-full sm:w-auto"
							disabled={!hasExportableData}
							onExportJson={() => {
								const analyzedRows = sortedPromptsWithMetrics.filter(
									(row) => row.metrics !== null,
								);
								const topPrompt = analyzedRows
									.slice()
									.sort(
										(a, b) =>
											(b.metrics?.geoScore ?? 0) - (a.metrics?.geoScore ?? 0),
									)[0];
								const weakestPrompt = analyzedRows
									.slice()
									.sort(
										(a, b) =>
											(a.metrics?.geoScore ?? 0) - (b.metrics?.geoScore ?? 0),
									)[0];
								const promptRows = sortedPromptsWithMetrics.map(
									({ prompt, metrics, modelProvider, reason }) => ({
										promptId: prompt.id,
										prompt: prompt.prompt,
										modelProvider,
										geoScore: metrics?.geoScore ?? null,
										sentiment: metrics?.sentiment ?? null,
										visibility: metrics?.visibility ?? null,
										position: metrics?.position ?? null,
										reason: reason ?? null,
										responses: filteredRecords
											.filter((r) => r.prompt_id === prompt.id)
											.map((r) => ({
												model: r.model_provider,
												promptRunAt: r.prompt_run_at,
												response: r.response,
												citations: r.sources?.length ?? 0,
												sources: (r.sources ?? []).map((source) => ({
													title: source.title ?? "",
													url: source.url ?? "",
													domain: source.domain ?? "",
													citedText: source.cited_text ?? "",
												})),
											})),
									}),
								);

								downloadJson(`prompts-${workspaceId}-${Date.now()}.json`, {
									generatedAt: new Date().toISOString(),
									workspaceId,
									report: {
										title: "Prompt Performance Export",
										version: "2.0",
										filters: { modelFilter, timeFilter, sortBy, sortDirection },
									},
									overview: {
										totalPrompts: sortedPromptsWithMetrics.length,
										analyzedPrompts: analyzedRows.length,
										unanalyzedPrompts:
											sortedPromptsWithMetrics.length - analyzedRows.length,
									},
									impactSummary: {
										highestGeoPrompt: topPrompt?.prompt.prompt ?? null,
										highestGeoScore: topPrompt?.metrics?.geoScore ?? null,
										lowestGeoPrompt: weakestPrompt?.prompt.prompt ?? null,
										lowestGeoScore: weakestPrompt?.metrics?.geoScore ?? null,
									},
									actionPriorities: [
										weakestPrompt
											? `Improve weak prompt: "${weakestPrompt.prompt.prompt}" (GEO ${weakestPrompt.metrics?.geoScore ?? 0}).`
											: null,
										sortedPromptsWithMetrics.some(
											(row) => row.reason === "brand-not-mentioned",
										)
											? "Revise prompts where brand is not mentioned to improve coverage."
											: null,
									].filter(Boolean),
									detailedData: {
										rows: promptRows,
									},
								});
							}}
							onExportCsv={() => {
								const analyzedPromptCount = sortedPromptsWithMetrics.filter(
									(row) => row.metrics !== null,
								).length;
								const rows = [
									{
										section: "overview",
										metric: "Total Prompts",
										value: sortedPromptsWithMetrics.length,
									},
									{
										section: "overview",
										metric: "Analyzed Prompts",
										value: analyzedPromptCount,
									},
									{
										section: "overview",
										metric: "Unanalyzed Prompts",
										value:
											sortedPromptsWithMetrics.length - analyzedPromptCount,
									},
									...sortedPromptsWithMetrics.map(
										({ prompt, metrics, modelProvider, reason }) => {
											const promptSources = filteredRecords
												.filter((r) => r.prompt_id === prompt.id)
												.flatMap((r) => r.sources ?? []);
											return {
												section: "prompt_details",
												prompt: prompt.prompt,
												model: modelProvider,
												geo_score: metrics?.geoScore ?? "",
												sentiment: metrics?.sentiment ?? "",
												visibility: metrics?.visibility ?? "",
												position: metrics?.position ?? "",
												status: reason ?? "ok",
												source_urls: joinSourceUrls(promptSources),
												cited_texts: joinCitedTexts(promptSources),
											};
										},
									),
								];
								downloadCsv(`prompts-${workspaceId}-${Date.now()}.csv`, rows);
							}}
						/>
						<Button
							variant="outline"
							onClick={handleSave}
							disabled={loading || !isModified || editIndex !== null}
							className={cn(
								formToolbarButtonClassName,
								"w-full gap-2 sm:w-auto",
							)}
						>
							{loading ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</div>

			{promptData.length > 0 ? (
				<div className="flex-1 px-4 pb-10 sm:px-6">
					<p className="mb-3 text-xs text-muted-foreground">
						Tip: Click a prompt row to view its responses.
					</p>
					<div className="overflow-x-auto">
						<Table className="w-full min-w-[760px] lg:min-w-[920px]">
							<TableHeader>
								<TableRow className="border-gray-100 border-b bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/40">
									<TableHead className="w-12 pl-4">
										<Checkbox
											checked={
												selectedRows.size === promptData.length &&
												promptData.length > 0
											}
											onCheckedChange={(checked) => {
												if (checked)
													setSelectedRows(
														new Set(promptData.map((_, idx) => idx)),
													);
												else setSelectedRows(new Set());
											}}
										/>
									</TableHead>
									<TableHead className="px-6 py-4 text-left font-medium text-gray-500 text-sm dark:text-gray-400">
										<SortableHeader
											column="prompt"
											currentSort={sortBy}
											currentDirection={sortDirection}
											onSort={handleColumnSort}
											onResetSort={resetColumnSort}
										>
											Prompt
										</SortableHeader>
									</TableHead>
									<TableHead className="px-6 py-4 text-center font-medium text-gray-500 text-sm dark:text-gray-400">
										<div className="flex justify-center">
											<SortableHeader
												column="geoScore"
												currentSort={sortBy}
												currentDirection={sortDirection}
												onSort={handleColumnSort}
												onResetSort={resetColumnSort}
											>
												GEO Score
											</SortableHeader>
										</div>
									</TableHead>
									<TableHead className="px-6 py-4 text-center font-medium text-gray-500 text-sm dark:text-gray-400">
										<div className="flex justify-center">
											<SortableHeader
												column="sentiment"
												currentSort={sortBy}
												currentDirection={sortDirection}
												onSort={handleColumnSort}
												onResetSort={resetColumnSort}
											>
												Sentiment
											</SortableHeader>
										</div>
									</TableHead>
									<TableHead className="px-6 py-4 text-center font-medium text-gray-500 text-sm dark:text-gray-400">
										<div className="flex justify-center">
											<SortableHeader
												column="visibility"
												currentSort={sortBy}
												currentDirection={sortDirection}
												onSort={handleColumnSort}
												onResetSort={resetColumnSort}
											>
												Visibility
											</SortableHeader>
										</div>
									</TableHead>
									<TableHead className="px-6 py-4 text-center font-medium text-gray-500 text-sm dark:text-gray-400">
										<div className="flex justify-center">
											<SortableHeader
												column="position"
												currentSort={sortBy}
												currentDirection={sortDirection}
												onSort={handleColumnSort}
												onResetSort={resetColumnSort}
											>
												Position
											</SortableHeader>
										</div>
									</TableHead>
								</TableRow>
							</TableHeader>

							<TableBody>
								{sortedPromptsWithMetrics.map(
									({ prompt, metrics, modelProvider, reason, sourceIndex }) => (
										<TableRow
											key={prompt.id}
											onClick={() => {
												setPromptResponsesScrolled(false);
												setOpenPrompt(prompt);
											}}
											className="cursor-pointer border-gray-100/50 border-b transition-colors last:border-none hover:bg-gray-50 dark:border-gray-800/40 dark:hover:bg-gray-900/60"
										>
											<TableCell className="pl-4">
												<Checkbox
													checked={selectedRows.has(sourceIndex)}
													onCheckedChange={() => toggleRow(sourceIndex)}
													onClick={(e) => e.stopPropagation()}
												/>
											</TableCell>

											<TableCell className="max-w-2xl px-6 py-5 text-gray-800 text-sm leading-relaxed dark:text-gray-200">
												{prompt.prompt}
											</TableCell>

											{!metrics ? (
												<TableCell
													className="px-6 py-5 text-center text-gray-400 text-sm dark:text-gray-500"
													colSpan={5}
												>
													<span className="italic">
														{reason === "no-responses"
															? "No responses yet"
															: reason === "unanalyzed"
																? "Analysis in progress..."
																: reason === "brand-not-mentioned"
																	? "Brand not mentioned in this prompt"
																	: "No data available"}
													</span>
												</TableCell>
											) : (
												<>
													<TableCell className="px-6 py-5 text-center text-sm">
														<span
															className="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-1 font-semibold text-xs"
															style={{
																color:
																	metrics.geoScore >= 60
																		? "#22c55e"
																		: metrics.geoScore >= 30
																			? "#f59e0b"
																			: "#ef4444",
															}}
														>
															{metrics.geoScore}
														</span>
													</TableCell>

													<TableCell className="px-6 py-5 text-center">
														<SentimentMetricCell
															sentiment={metrics.sentiment}
														/>
													</TableCell>

													<TableCell className="px-6 py-5 text-center text-gray-700 text-sm dark:text-gray-300">
														<span className="inline-block rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300">
															{metrics.visibility}%
														</span>
													</TableCell>

													<TableCell className="px-6 py-5 text-center">
														{metrics.position !== null ? (
															<PositionMetricCell position={metrics.position} />
														) : (
															<span className="text-gray-400 text-xs italic">
																N/A
															</span>
														)}
													</TableCell>
												</>
											)}
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
						<Dialog
							open={!!openPrompt}
							onOpenChange={() => {
								setOpenPrompt(null);
								setPromptResponsesScrolled(false);
							}}
						>
							<DialogContent
								className={cn(
									formDialogContentClassName,
									"!flex h-[90vh] !w-[94vw] !max-w-[94vw] flex-col bg-stone-50 pb-5 sm:!w-[88vw] sm:!max-w-[88vw] lg:!w-[80vw] lg:!max-w-[80vw] sm:pb-6 dark:bg-neutral-950",
								)}
							>
								<div
									className={cn(
										formDialogStickyTopClassName,
										"relative border-0 bg-stone-50/82 px-5 pt-5 pb-3 shadow-none sm:px-6 sm:pt-6 dark:bg-neutral-950/78",
										promptResponsesScrolled &&
											"shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_30px_-28px_rgba(0,0,0,0.45)]",
									)}
								>
									<DialogHeader
										className={cn(
											formDialogHeaderClassName,
											"relative z-[2] space-y-0.5 px-0 pt-1 pb-3 sm:px-0 sm:pt-1",
										)}
									>
										<DialogTitle
											className={cn(
												formSectionTitleClassName,
												"text-base leading-6 sm:text-[1.0625rem]",
											)}
										>
											{openPrompt?.prompt}
										</DialogTitle>
										<span
											className={cn(
												formSectionDescriptionClassName,
												"text-[13px] leading-5",
											)}
										>
											{openPromptRecords.length} response
											{openPromptRecords.length !== 1 ? "s" : ""}
										</span>
									</DialogHeader>

									<div className="relative z-[2] flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
										<ProviderModelSelect
											value={modelFilter}
											onValueChange={setModelFilter}
											triggerClassName={cn(
												formToolbarSelectClassName,
												"w-full border-transparent sm:w-auto",
											)}
											contentClassName="z-[9999]"
										/>

										<TimeRangeSelect
											value={timeFilter}
											onValueChange={setTimeFilter}
											triggerClassName={cn(
												formToolbarSelectClassName,
												"w-full border-transparent sm:w-auto",
											)}
										/>
									</div>
								</div>

								<DialogDescription className="sr-only">
									This dialog shows AI model responses for the selected prompt.
								</DialogDescription>

								<div
									className={cn(
										formDialogScrollBodyClassName,
										"bg-stone-50 pt-0 pr-2 pb-5 dark:bg-neutral-950",
									)}
									onScroll={(event) => {
										setPromptResponsesScrolled(
											event.currentTarget.scrollTop > 0,
										);
									}}
								>
									{openPromptRecords.length > 0 ? (
										openPromptRecords.map(
											(record: AnalysisRecord, index: number) => {
												const isExpanded = expandedResponses.has(index);

												return (
													<div
														key={record.id}
														onClick={() => toggleResponse(index)}
														onKeyDown={(event) => {
															if (event.key === "Enter" || event.key === " ") {
																event.preventDefault();
																toggleResponse(index);
															}
														}}
														data-expanded={isExpanded}
														className={cn(
															formResponsePreviewCardClassName,
															"group cursor-pointer",
															isExpanded &&
																"border-gray-200 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.22)] dark:border-gray-700",
														)}
													>
														<div className="mb-4 flex items-start justify-between gap-4">
															<div className="flex items-center gap-3.5">
																<img
																	src={getModelFavicon(record.model_provider)}
																	alt={record.model_provider}
																	className="h-7 w-7 rounded-[12px]"
																/>

																<div className="flex flex-col">
																	<span className="text-sm font-medium text-gray-950 dark:text-gray-50">
																		{modelSelectors.find(
																			(m) => m.value === record.model_provider,
																		)?.label || record.model_provider}
																	</span>

																	<span className="text-[11px] text-gray-500 dark:text-gray-400">
																		{formatDate(record.prompt_run_at)}
																	</span>
																</div>
															</div>

															<ChevronDown
																className={cn(
																	"h-5 w-5 text-gray-400 transition-transform duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300",
																	isExpanded ? "rotate-180" : "rotate-0",
																)}
															/>
														</div>

														{/* Metrics Display - Always visible at top */}
														{record.is_analysed && record.brand_analysis && (
															<div
																className={cn(
																	formResponseMetricsPanelClassName,
																	"mb-4",
																)}
															>
																<div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
																	<div className="flex items-center gap-1.5">
																		<span className="text-[10px] text-gray-400 uppercase tracking-wide dark:text-gray-500">
																			GEO Score
																		</span>
																		<span
																			className="font-semibold text-xs"
																			style={{
																				color:
																					record.brand_analysis.geoScore
																						.overall >= 60
																						? "#22c55e"
																						: record.brand_analysis.geoScore
																									.overall >= 30
																							? "#f59e0b"
																							: "#ef4444",
																			}}
																		>
																			{record.brand_analysis.geoScore.overall}
																		</span>
																	</div>
																	<div className="flex items-center gap-1.5">
																		<span className="text-[10px] text-gray-400 uppercase tracking-wide dark:text-gray-500">
																			Sentiment
																		</span>
																		<div className="text-xs">
																			<SentimentMetricCell
																				sentiment={
																					record.brand_analysis.sentiment.score
																				}
																			/>
																		</div>
																	</div>
																	<div className="flex items-center gap-1.5">
																		<span className="text-[10px] text-gray-400 uppercase tracking-wide dark:text-gray-500">
																			Visibility
																		</span>
																		<span className="font-semibold text-gray-900 text-xs dark:text-gray-100">
																			{
																				record.brand_analysis.presence
																					.visibility
																			}
																			%
																		</span>
																	</div>
																	<div className="flex items-center gap-1.5">
																		<span className="text-[10px] text-gray-400 uppercase tracking-wide dark:text-gray-500">
																			Position
																		</span>
																		<div className="text-xs">
																			{record.brand_analysis.position
																				.rankPosition !== null ? (
																				<PositionMetricCell
																					position={
																						record.brand_analysis.position
																							.rankPosition
																					}
																				/>
																			) : (
																				<span className="text-gray-400 italic">
																					N/A
																				</span>
																			)}
																		</div>
																	</div>
																</div>
															</div>
														)}

														{/* Analysis Status for Unanalyzed Responses */}
														{!record.is_analysed && (
															<div
																className={cn(
																	formResponseMetricsPanelClassName,
																	"mb-4",
																)}
															>
																<div className="flex items-center gap-2">
																	<div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
																	<span className="text-xs text-gray-500 dark:text-gray-400">
																		Analysis in progress...
																	</span>
																</div>
															</div>
														)}

														<div
															className={cn(
																"prose prose-sm prose-headings:mt-4 prose-headings:mb-2 prose-hr:my-4 prose-li:my-0.5 prose-ol:my-3 prose-p:my-3 prose-ul:my-3 max-w-none px-1 pt-1 text-[0.9375rem] leading-7 text-gray-700 transition-all duration-200 ease-in-out dark:prose-invert dark:text-gray-300",
																!isExpanded && "line-clamp-3 overflow-hidden",
															)}
															// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by shared formatter before rendering
															dangerouslySetInnerHTML={{
																__html: formatMarkdown(record.response),
															}}
														/>

														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																toggleResponse(index);
															}}
															className={cn(formSubtleActionClassName, "mt-4")}
														>
															{isExpanded ? "Show less" : "View full response"}
														</button>

														<SourcesHoverLinks items={record.sources} />
													</div>
												);
											},
										)
									) : (
										<div className="web-empty-state py-12">
											<div className="web-empty-state-icon">
												<FilterX className="h-5 w-5 text-gray-400" />
											</div>

											<h3 className="font-medium text-gray-900 text-md dark:text-gray-100">
												No responses match your filters
											</h3>

											<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
												Try adjusting the selected model or time range to see
												available responses.
											</p>
										</div>
									)}
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			) : (
				<EmptyStatePanel
					title="Start With Audience Questions"
					description="Add the questions your target audience already searches for."
					examplesLabel="Prompt ideas"
					examples={[
						"What's the best project management software for a small remote team?",
						"Which accounting tools are easiest for freelancers who hate bookkeeping?",
						"What help desk software is best for a fast-growing ecommerce brand?",
					]}
					action={
						<Button onClick={() => setDialogOpen(true)} className="gap-2">
							<Plus className="h-4 w-4" />
							Add first prompt
						</Button>
					}
					className="min-h-[60vh] px-6"
				/>
			)}
		</div>
	);
}
