"use client";

import { ExportMenu } from "@/components/export-menu";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import type { AnalysisRecord, UserPrompt } from "@oneglanse/types";
import type { Source } from "@oneglanse/types";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
	toast,
} from "@oneglanse/ui";
import { PositionMetricCell, SentimentMetricCell } from "@oneglanse/ui";
import {
	filterAnalysisRecords,
	formatDate,
	formatMarkdown,
	getDomain,
	getFaviconUrls,
	getModelFavicon,
	getUniqueLinks,
	modelSelectors,
} from "@oneglanse/utils";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	Bot,
	ChevronDown,
	FilterX,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
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
	currentDirection: "asc" | "desc";
	onSort: (column: SortColumn) => void;
}) {
	const isActive = currentSort === column;

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onSort(column);
			}}
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

export default function Prompts() {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const [initialPrompts, setInitialPrompts] = useState<UserPrompt[]>([]);
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">(
		"all",
	);
	const [sortBy, setSortBy] = useState<SortColumn>("prompt");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
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

	const storePromptMutation = useStorePrompt();

	useEffect(() => {
		if (userPrompts?.length) {
			setPromptData(userPrompts);
			setInitialPrompts(userPrompts);
		}
	}, [userPrompts]);

	useEffect(() => {
		if (!analysedPromptData) return;

		const data = analysedPromptData;
		const records: AnalysisRecord[] = Array.isArray(data)
			? data
			: data &&
					typeof data === "object" &&
					"records" in data &&
					Array.isArray((data as any).records)
				? (data as any).records
				: [];

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

	const handleColumnSort = (column: SortColumn) => {
		if (sortBy === column) {
			// Toggle direction if same column
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			// New column, default to ascending for text, descending for numbers
			setSortBy(column);
			setSortDirection(column === "prompt" ? "asc" : "desc");
		}
	};

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
		<div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
			<div className="mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
				<Bot className="h-5 w-5 text-gray-400 dark:text-gray-500" />
			</div>
			<p className="text-gray-500 text-sm dark:text-gray-400">
				Loading your prompts…
			</p>
		</div>
	);

	if (!workspaceId) {
		return (
			<div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
				<p className="text-sm text-gray-500">No workspace selected.</p>
			</div>
		);
	}

	if (userPromptsError || analysedPromptError) {
		return (
			<div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
				<p className="text-sm text-gray-500">
					We couldn&apos;t load your prompts right now.
				</p>
			</div>
		);
	}

	if (isUserPromptsLoading || isAnalysedPromptsLoading) {
		return (
			<div className="flex h-screen flex-col">
				<div className="flex items-center justify-between px-6 py-4">
					<Skeleton className="h-8 w-24 rounded-lg" />
					<Skeleton className="h-9 w-28 rounded-xl" />
				</div>

				<LoadingState />
			</div>
		);
	}

	return (
		<div className="ui-page-enter ui-stagger flex h-screen flex-col">
			<div className="px-6 py-6">
				{/* Single Row: Actions + Filters */}
				<div className="flex items-center justify-between gap-4">
					{/* Left: Prompt actions */}
					<div className="flex items-center gap-2">
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
									<Button variant="outline" size="sm" className="gap-2">
										<Plus size={16} />
										<span>Add Prompt</span>
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>
											{editIndex !== null ? "Edit Prompt" : "Add New Prompt"}
										</DialogTitle>
									</DialogHeader>
									<Textarea
										placeholder="Type your prompt..."
										rows={4}
										value={editIndex !== null ? editPromptValue : currentPrompt}
										onChange={(e) =>
											editIndex !== null
												? setEditPromptValue(e.target.value)
												: setCurrentPrompt(e.target.value)
										}
										className="mt-2 w-full"
									/>
									<div className="mt-4 flex justify-end gap-2">
										<Button
											variant="outline"
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
									size="sm"
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
									className="gap-2"
								>
									<Pencil size={16} />
									<span>Edit</span>
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="gap-2 text-red-600 hover:bg-red-50"
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
					<div className="flex items-center gap-3">
						{/* Model filter */}
						<Select value={modelFilter} onValueChange={setModelFilter}>
							<SelectTrigger className="h-9 w-44 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
								<SelectValue placeholder="Select Model" />
							</SelectTrigger>
							<SelectContent className="z-[9999]">
								{modelSelectors.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										<div className="flex items-center gap-2">
											{value === "All Models" ? (
												<Bot className="h-4 w-4 text-muted-foreground" />
											) : (
												<img
													src={getModelFavicon(value)}
													alt={value}
													className="h-4 w-4 rounded-sm"
												/>
											)}
											<span>{label}</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Time filter */}
						<Select
							value={timeFilter}
							onValueChange={(value) =>
								setTimeFilter(value as "all" | "7d" | "14d" | "30d")
							}
						>
							<SelectTrigger className="h-9 w-40 text-sm">
								<SelectValue placeholder="Time range" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All time</SelectItem>
								<SelectItem value="7d">Last 7 days</SelectItem>
								<SelectItem value="14d">Last 14 days</SelectItem>
								<SelectItem value="30d">Last 30 days</SelectItem>
							</SelectContent>
						</Select>

						{/* Clear filters button */}
						{(modelFilter !== "All Models" || timeFilter !== "all") && (
							<>
								<Separator orientation="vertical" className="h-4" />
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setModelFilter("All Models");
										setTimeFilter("all");
									}}
									className="gap-2 text-gray-500 hover:text-gray-700"
								>
									<FilterX size={14} />
									Clear
								</Button>
							</>
						)}
					</div>

					{/* Right: Save action */}
					<div className="flex items-center gap-2">
						<ExportMenu
							disabled={sortedPromptsWithMetrics.length === 0}
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
										({ prompt, metrics, modelProvider, reason }) => ({
											section: "prompt_details",
											prompt: prompt.prompt,
											model: modelProvider,
											geo_score: metrics?.geoScore ?? "",
											sentiment: metrics?.sentiment ?? "",
											visibility: metrics?.visibility ?? "",
											position: metrics?.position ?? "",
											status: reason ?? "ok",
											source_urls: filteredRecords
												.filter((r) => r.prompt_id === prompt.id)
												.flatMap((r) => r.sources ?? [])
												.map((source) => source.url)
												.filter(Boolean)
												.join(" | "),
											cited_texts: filteredRecords
												.filter((r) => r.prompt_id === prompt.id)
												.flatMap((r) => r.sources ?? [])
												.map((source) => source.cited_text)
												.filter(Boolean)
												.join(" | "),
										}),
									),
								];
								downloadCsv(`prompts-${workspaceId}-${Date.now()}.csv`, rows);
							}}
						/>
						<Button
							variant="outline"
							onClick={handleSave}
							disabled={loading || !isModified || editIndex !== null}
							className="gap-2"
						>
							{loading ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</div>

			{promptData.length > 0 ? (
				<div className="flex-1 overflow-y-auto px-6 pb-10">
					<div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
						<Table className="min-w-full">
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
											onClick={() => setOpenPrompt(prompt)}
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
							onOpenChange={() => setOpenPrompt(null)}
						>
							<DialogContent className="!max-w-[90vw] !w-[90vw] sm:!max-w-[80vw] sm:!w-[80vw] flex h-[90vh] flex-col rounded-2xl px-8 pb-8 sm:px-10 sm:pt-12 sm:pb-10 ">
								<DialogHeader className="pb-6">
									<DialogTitle className="font-semibold text-xl">
										{openPrompt?.prompt}
									</DialogTitle>
									<span className="text-gray-500 text-sm">
										{openPromptRecords.length} response
										{openPromptRecords.length !== 1 ? "s" : ""}
									</span>
								</DialogHeader>

								{/* Filter bar */}
								<div className="flex items-center gap-3 pb-6">
									{/* Model filter */}
									<Select value={modelFilter} onValueChange={setModelFilter}>
										<SelectTrigger className="h-9 w-44 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
											<SelectValue placeholder="Select Model" />
										</SelectTrigger>
										<SelectContent className="z-[9999]">
											{modelSelectors.map(({ value, label }) => (
												<SelectItem key={value} value={value}>
													<div className="flex items-center gap-2">
														{value === "All Models" ? (
															<Bot className="h-4 w-4 text-muted-foreground" />
														) : (
															<img
																src={getModelFavicon(value)}
																alt={value}
																className="h-4 w-4 rounded-sm"
															/>
														)}
														<span>{label}</span>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{/* Time filter */}
									<Select
										value={timeFilter}
										onValueChange={(value) =>
											setTimeFilter(value as "all" | "7d" | "14d" | "30d")
										}
									>
										<SelectTrigger className="h-9 w-40 text-sm">
											<SelectValue placeholder="Time range" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All time</SelectItem>
											<SelectItem value="7d">Last 7 days</SelectItem>
											<SelectItem value="14d">Last 14 days</SelectItem>
											<SelectItem value="30d">Last 30 days</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<DialogDescription className="sr-only">
									This dialog shows AI model responses for the selected prompt.
								</DialogDescription>

								<div className="flex-1 space-y-6 overflow-y-auto pr-2">
									{openPromptRecords.length > 0 ? (
										openPromptRecords.map(
											(record: AnalysisRecord, index: number) => {
												const isExpanded = expandedResponses.has(index);

												return (
													<div
														key={record.id}
														onClick={() => toggleResponse(index)}
														data-expanded={isExpanded}
														className={`group cursor-pointer rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm transition-all duration-200 ease-out hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/20 ${isExpanded ? "shadow-lg ring-1 ring-gray-200 dark:ring-gray-700" : ""}
                          `}
													>
														<div className="mb-4 flex items-start justify-between">
															<div className="flex items-center gap-4">
																<img
																	src={getModelFavicon(record.model_provider)}
																	alt={record.model_provider}
																	className="h-7 w-7 rounded-md"
																/>

																<div className="flex flex-col">
																	<span className="font-semibold text-gray-900 text-md dark:text-gray-100">
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
																className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-0"}group-hover:text-gray-600 dark:group-hover:text-gray-300 `}
															/>
														</div>

														{/* Metrics Display - Always visible at top */}
														{record.is_analysed && record.brand_analysis && (
															<div className="mb-4 border-gray-100 border-b pb-3 dark:border-gray-800">
																<div className="flex flex-wrap items-center gap-4">
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
															<div className="mb-4 border-gray-100 border-b pb-3 dark:border-gray-800">
																<div className="flex items-center gap-2">
																	<div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
																	<span className="text-xs text-gray-500 dark:text-gray-400">
																		Analysis in progress...
																	</span>
																</div>
															</div>
														)}

														<div
															className={`prose prose-sm dark:prose-invert prose-hr:my-6 prose-li:my-1 prose-ol:my-4 prose-p:my-4 prose-ul:my-4 prose-headings:mt-6 prose-headings:mb-3 max-w-none transition-all duration-200 ease-in-out ${isExpanded ? "" : "line-clamp-3 overflow-hidden"}
                            `}
															dangerouslySetInnerHTML={{
																__html: formatMarkdown(record.response),
															}}
														/>

														<button
															onClick={(e) => {
																e.stopPropagation();
																toggleResponse(index);
															}}
															className="mt-3 font-medium text-gray-500 text-xs opacity-70 transition-colors hover:text-gray-800 group-hover:opacity-100 dark:hover:text-gray-200 "
														>
															{isExpanded ? "Show less" : "View full response"}
														</button>

														<SourcesCard
															key={record.id}
															sources={record.sources}
														/>
													</div>
												);
											},
										)
									) : (
										<div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
											<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
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
				<div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
					<button
						onClick={() => setDialogOpen(true)}
						className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
					>
						<Plus className="h-5 w-5 text-gray-500 dark:text-gray-400" />
					</button>

					<h3 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
						No prompts yet
					</h3>

					<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
						You haven’t added any prompts yet. Start by adding your first prompt
						to analyze model responses and brand metrics.
					</p>
				</div>
			)}
		</div>
	);
}

function SourcesCard({
	sources,
}: {
	sources: Source[];
}) {
	const MAX_VISIBLE = 5;
	const [showAllLinks, setShowAllLinks] = useState(false);

	const linksToShow = useMemo(() => {
		return getUniqueLinks(sources);
	}, [sources]);

	const visibleLinks = showAllLinks
		? linksToShow
		: linksToShow.slice(0, MAX_VISIBLE);

	const remainingCount = linksToShow.length - MAX_VISIBLE;

	if (linksToShow.length === 0) return null;

	return (
		<div
			className="group mt-3 flex flex-wrap gap-2"
			onClick={(e) => e.stopPropagation()}
		>
			{visibleLinks.map((item, i) => {
				const faviconUrls = getFaviconUrls(item.url, "");
				const domain = getDomain(item.url);

				return (
					<a
						key={`${item.url}-${i}`}
						href={item.url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						title={item.title}
						className="relative inline-flex h-[36px] items-start gap-2 overflow-hidden rounded-md border border-gray-200/60 bg-gray-50/50 px-2.5 py-2 text-[11px] text-gray-600 transition-all duration-200 ease-out group-hover:h-[52px] dark:border-gray-800/60 dark:bg-gray-900/50 dark:text-gray-400 "
					>
						{/* Icon column */}
						{faviconUrls[0] && (
							<img
								src={faviconUrls[0]}
								alt=""
								className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-sm opacity-75 transition-opacity group-hover:opacity-100 "
							/>
						)}

						<div className="flex flex-col gap-0.5 overflow-hidden">
							<span className="line-clamp-2 leading-snug">{item.title}</span>

							{domain && (
								<span className="translate-y-1 truncate text-[10px] text-gray-400 opacity-0 transition-all delay-75 duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 ">
									{domain}
								</span>
							)}
						</div>
					</a>
				);
			})}

			{!showAllLinks && remainingCount > 0 && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						setShowAllLinks(true);
					}}
					className="inline-flex items-center rounded-md border border-gray-300/70 border-dashed px-2.5 py-1.5 text-[11px] text-gray-500 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-700/70 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200 "
				>
					+{remainingCount} more
				</button>
			)}
		</div>
	);
}
