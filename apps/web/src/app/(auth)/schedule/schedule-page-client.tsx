"use client";

import {
	formDialogContentClassName,
	formDialogFooterClassName,
	formDialogHeaderClassName,
	formHintClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import {
	clearActiveProviderRun,
	handleAgentRunResult,
	persistActiveProviderRun,
} from "@/components/provider-run-toast";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type { AppMode } from "@oneglanse/types";
import { canConfigureRecurringScheduleInMode } from "@oneglanse/types";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ScrollArea,
	Skeleton,
	toast,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import {
	Calendar,
	Check,
	Loader2,
	PlayCircle,
	SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function localHourToUTC(localHour: number): number {
	const now = new Date();
	now.setHours(localHour, 0, 0, 0);
	return now.getUTCHours();
}

function formatAbsoluteTime(timestamp: string | null): string {
	if (!timestamp) return "Never";

	const date = new Date(timestamp);
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});
}

function formatRelativeTime(timestamp: string | null): string {
	if (!timestamp) return "Not scheduled";

	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMs < 0) {
		return formatAbsoluteTime(timestamp);
	}
	if (diffMins < 1) {
		return "In less than a minute";
	}
	if (diffMins < 60) {
		return `In ${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
	}
	if (diffHours < 24) {
		return `In ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
	}
	if (diffDays < 7) {
		return `In ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
	}

	return formatAbsoluteTime(timestamp);
}

function getScheduleOptions() {
	return [
		{
			label: "Every 12 hours",
			value: "0 */12 * * *",
			description: "Runs twice daily starting at midnight",
		},
		{
			label: "Every day at midnight",
			value: `0 ${localHourToUTC(0)} * * *`,
			description: "Runs daily at midnight",
		},
		{
			label: "Every 2 days at midnight",
			value: `0 ${localHourToUTC(0)} */2 * *`,
			description: "Runs every other day at midnight",
		},
		{
			label: "Every week (Sunday midnight)",
			value: `0 ${localHourToUTC(0)} * * 0`,
			description: "Runs every Sunday at midnight",
		},
	];
}

const SCHEDULE_OPTIONS = getScheduleOptions();
const TIMING_SKELETON_KEYS = ["timing-a", "timing-b"] as const;
const SCHEDULE_SKELETON_KEYS = [
	"schedule-a",
	"schedule-b",
	"schedule-c",
	"schedule-d",
] as const;

function getScheduleLabel(cron: string | null): string {
	if (!cron) return "Not scheduled";
	const match = SCHEDULE_OPTIONS.find((opt) => opt.value === cron);
	return match?.label ?? cron;
}

function PromptSelectionCard({ workspaceId }: { workspaceId: string }) {
	const promptsQuery = api.prompt.fetchUserPrompts.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const selectedQuery = api.workspace.getSelectedPrompts.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const setSelectedMutation = api.workspace.setSelectedPrompts.useMutation();
	const [localSelected, setLocalSelected] = useState<string[] | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (selectedQuery.data !== undefined) {
			setLocalSelected(selectedQuery.data.selectedPromptIds ?? null);
		}
	}, [selectedQuery.data]);

	const prompts = promptsQuery.data ?? [];
	const savedIds = selectedQuery.data?.selectedPromptIds ?? null;
	const allPromptIds = prompts.map((prompt) => prompt.id);
	const effectiveSelected =
		localSelected === null ? allPromptIds : localSelected;
	const selectedCount = effectiveSelected.length;
	const savedEffectiveSelected = savedIds === null ? allPromptIds : savedIds;
	const hasChanges =
		JSON.stringify([...effectiveSelected].sort()) !==
		JSON.stringify([...savedEffectiveSelected].sort());
	const isAllSelected =
		prompts.length > 0 && effectiveSelected.length === prompts.length;
	const getPromptCreatedAt = (prompt: (typeof prompts)[number]) =>
		new Date(prompt.created_at).getTime();
	const orderedPrompts = [...prompts].sort((left, right) => {
		const leftSelected = effectiveSelected.includes(left.id);
		const rightSelected = effectiveSelected.includes(right.id);

		if (leftSelected !== rightSelected) {
			return leftSelected ? -1 : 1;
		}

		return getPromptCreatedAt(right) - getPromptCreatedAt(left);
	});
	const togglePrompt = (id: string) => {
		setLocalSelected((prev) => {
			const current = prev === null ? allPromptIds : prev;
			const isChecked = current.includes(id);
			const next = isChecked
				? current.filter((pid) => pid !== id)
				: [...current, id];
			return next.length === prompts.length ? null : next;
		});
	};

	const toggleAllPrompts = () => {
		setLocalSelected((prev) => {
			const current = prev === null ? allPromptIds : prev;
			return current.length === prompts.length ? [] : null;
		});
	};

	const handleSave = async () => {
		if (effectiveSelected.length === 0) {
			toast.error("Select at least one prompt to run.");
			return;
		}

		setSaving(true);
		try {
			await setSelectedMutation.mutateAsync({
				workspaceId,
				selectedPromptIds: isAllSelected ? null : effectiveSelected,
			});
			await selectedQuery.refetch();
			setIsDialogOpen(false);
			toast.success("Prompts for this workspace updated.");
		} catch {
			toast.error("Failed to save selection.");
		} finally {
			setSaving(false);
		}
	};

	const isLoading = promptsQuery.isLoading || selectedQuery.isLoading;

	return (
		<div className={cn(formPanelClassName, "px-5 py-5")}>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0 space-y-0.5">
						<div className="flex min-w-0 items-center gap-2">
							<h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Prompts For This Workspace
							</h2>
							{isLoading ? (
								<span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200/80 bg-stone-50 text-gray-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-300">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								</span>
							) : prompts.length > 0 ? (
								<span className="inline-flex shrink-0 items-center rounded-full border border-gray-200/80 bg-stone-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-300">
									{isAllSelected
										? `${prompts.length} of ${prompts.length} selected`
										: `${selectedCount} of ${prompts.length} selected`}
								</span>
							) : null}
						</div>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Choose which prompts this workspace should run.
						</p>
					</div>
					<Button
						variant="ghost"
						onClick={() => setIsDialogOpen(true)}
						className={cn(
							formSecondaryButtonClassName,
							"h-10 w-full rounded-[var(--app-radius)] border border-gray-200/70 px-4 text-sm font-medium dark:border-gray-700/80 sm:w-auto",
						)}
					>
						<SlidersHorizontal className="h-4 w-4" />
						Configure Prompts
					</Button>
				</div>

				{isLoading ? null : prompts.length === 0 ? (
					<p className="text-sm text-gray-500 dark:text-gray-400">
						No prompts yet.{" "}
						<a
							href={`/prompts?workspace=${workspaceId}`}
							className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
						>
							Add some on the Prompts page
						</a>{" "}
						to get started.
					</p>
				) : null}
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent
					className={cn(
						formDialogContentClassName,
						"!max-w-[min(100vw-1.5rem,56rem)] max-h-[min(100dvh-1.5rem,48rem)] grid-rows-[auto,minmax(0,1fr),auto] border-transparent bg-white shadow-[0_20px_70px_-34px_rgba(15,23,42,0.26)] dark:bg-neutral-950 dark:shadow-[0_24px_80px_-36px_rgba(0,0,0,0.58)]",
					)}
				>
					<DialogHeader
						className={cn(
							formDialogHeaderClassName,
							"space-y-0.5 sm:space-y-0.5",
						)}
					>
						<DialogTitle className="text-lg font-semibold tracking-[-0.02em] text-gray-950 leading-tight dark:text-gray-50">
							Select Prompts
						</DialogTitle>
						<DialogDescription className="text-sm leading-5 text-gray-500 dark:text-gray-400">
							Choose what this workspace should run.
						</DialogDescription>
					</DialogHeader>

					<ScrollArea className="h-full min-h-0 overflow-hidden px-4 pt-2 sm:px-5">
						<div className="space-y-2 pb-4">
							<button
								type="button"
								onClick={toggleAllPrompts}
								className={cn(
									"flex w-full items-center gap-3 rounded-[var(--app-radius)] border bg-white px-4 py-3.5 text-left transition-[border-color,box-shadow,opacity] duration-150 dark:bg-neutral-950",
									isAllSelected
										? "border-gray-200/70 shadow-[0_14px_32px_-22px_rgba(15,23,42,0.16)] dark:border-gray-700/80"
										: "border-gray-200/80 opacity-70 hover:opacity-100 dark:border-gray-800/80",
								)}
							>
								<div
									className={cn(
										"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
										isAllSelected
											? "border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-gray-950"
											: "border-gray-300 bg-transparent text-transparent dark:border-gray-600",
									)}
								>
									<Check className="h-3 w-3" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm leading-6 text-gray-900 dark:text-gray-100">
										Select all prompts
									</p>
								</div>
							</button>
							{orderedPrompts.map((prompt, index) => {
								const checked = effectiveSelected.includes(prompt.id);
								return (
									<button
										key={prompt.id}
										type="button"
										onClick={() => togglePrompt(prompt.id)}
										className={cn(
											"flex w-full items-center gap-3 rounded-[var(--app-radius)] border bg-white px-4 py-3.5 text-left transition-[border-color,box-shadow,opacity,transform] duration-150 dark:bg-neutral-950",
											checked
												? "border-gray-200/70 shadow-[0_14px_32px_-22px_rgba(15,23,42,0.16)] dark:border-gray-700/80"
												: "border-gray-200/80 opacity-70 hover:opacity-100 dark:border-gray-800/80",
										)}
									>
										<div
											className={cn(
												"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
												checked
													? "border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-gray-950"
													: "border-gray-300 bg-transparent text-transparent dark:border-gray-600",
											)}
										>
											<Check className="h-3 w-3" />
										</div>
										<div className="min-w-0 flex-1">
											<div
												className={cn(
													"mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
													checked
														? "text-gray-500 dark:text-gray-400"
														: "text-gray-400 dark:text-gray-500",
												)}
											>
												<span>Prompt {index + 1}</span>
											</div>
											<p
												className={cn(
													"line-clamp-2 text-sm leading-6",
													checked
														? "text-gray-900 dark:text-gray-100"
														: "text-gray-600 dark:text-gray-400",
												)}
											>
												{prompt.prompt}
											</p>
										</div>
									</button>
								);
							})}
						</div>
					</ScrollArea>

					<DialogFooter className={formDialogFooterClassName}>
						<Button
							variant="ghost"
							onClick={() => setIsDialogOpen(false)}
							className={cn(
								formSecondaryButtonClassName,
								"h-10 rounded-[var(--app-radius)] border border-gray-200/70 dark:border-gray-700/80",
							)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => void handleSave()}
							disabled={saving || effectiveSelected.length === 0 || !hasChanges}
							className={cn(
								formPrimaryButtonClassName,
								"h-10 w-auto rounded-[var(--app-radius)] border border-gray-200/70 px-5 dark:border-gray-700/80",
							)}
						>
							{saving ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Saving…
								</>
							) : (
								"Save selection"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ManualRunView({
	isRunning,
	onRunNow,
	mode,
	canRunNow,
}: {
	isRunning: boolean;
	onRunNow: () => Promise<void>;
	mode: "local" | "self-host";
	canRunNow: boolean;
}) {
	if (mode === "local") {
		return (
			<div className="flex flex-col gap-3">
				<div
					className={cn(
						formPanelClassName,
						"flex items-center justify-between gap-4 px-5 py-5",
					)}
				>
					<div className="flex items-center gap-4">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
							<PlayCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
						</div>
						<div className="space-y-0.5">
							<h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Run Selected Prompts
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								{canRunNow
									? "Start one fresh run for this workspace now."
									: "Add prompts on the Prompts page and select at least one to enable runs."}
							</p>
						</div>
					</div>
					<Button
						onClick={() => void onRunNow()}
						disabled={isRunning || !canRunNow}
						className="shrink-0 rounded-[var(--app-radius)] border border-gray-200/70 dark:border-gray-700/80"
					>
						{isRunning ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Running…
							</>
						) : (
							"Start run"
						)}
					</Button>
				</div>

				<div
					className={cn(
						formPanelClassName,
						"flex items-center justify-between gap-4 px-5 py-5 opacity-50",
					)}
				>
					<div className="flex items-center gap-4">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
							<Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
						</div>
						<div className="space-y-0.5">
							<h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Recurring schedules
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Auto-run on a schedule. Available in self-host mode.
							</p>
						</div>
					</div>
					<span className="inline-flex h-9 shrink-0 items-center rounded-[var(--app-radius)] border border-gray-200/70 px-4 text-sm font-medium text-gray-500 dark:border-gray-700/80 dark:text-gray-400">
						Self-host
					</span>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				formPanelClassName,
				"flex items-center justify-between gap-4 px-5 py-5",
			)}
		>
			<div className="flex items-center gap-4">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
					<PlayCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
				</div>
				<div className="space-y-0.5">
					<h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
						Run Selected Prompts
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						{canRunNow
							? "Start one immediate run without changing the recurring schedule."
							: "Add prompts on the Prompts page and select at least one to enable runs."}
					</p>
				</div>
			</div>
			<Button
				onClick={() => void onRunNow()}
				disabled={isRunning || !canRunNow}
				className="shrink-0 rounded-[var(--app-radius)] border border-gray-200/70 dark:border-gray-700/80"
			>
				{isRunning ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Running…
					</>
				) : (
					"Start run"
				)}
			</Button>
		</div>
	);
}

function ScheduleIntro({
	mode,
}: {
	mode: "local" | "self-host";
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-100">
				Workspace Runs
			</h2>
			<p className="text-sm text-gray-500 dark:text-gray-400">
				{mode === "local"
					? "Choose the prompts for this workspace and run them whenever you need fresh results."
					: "Choose the prompts for this workspace and manage both recurring and manual runs."}
			</p>
		</div>
	);
}

function TimingSummary({
	currentSchedule,
	nextRun,
	lastPromptRun,
}: {
	currentSchedule: string | null;
	nextRun: string | null | undefined;
	lastPromptRun: string | null | undefined;
}) {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div className={cn(formPanelClassName, "space-y-2 px-5 py-5")}>
				<div className="flex items-center gap-2">
					<Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					<span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
						Next run
					</span>
				</div>
				<p className="text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
					{currentSchedule && nextRun
						? formatRelativeTime(nextRun)
						: "Not scheduled"}
				</p>
			</div>

			<div className={cn(formPanelClassName, "space-y-2 px-5 py-5")}>
				<div className="flex items-center gap-2">
					<PlayCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					<span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
						Last run
					</span>
				</div>
				<p className="text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
					{lastPromptRun ? formatAbsoluteTime(lastPromptRun) : "Never"}
				</p>
			</div>
		</div>
	);
}

function ScheduleOptionsSection({
	currentSchedule,
	selected,
	saving,
	hasChanges,
	onSelect,
	onDisable,
	onSave,
}: {
	currentSchedule: string | null;
	selected: string | null;
	saving: boolean;
	hasChanges: boolean;
	onSelect: (value: string) => void;
	onDisable: () => Promise<void>;
	onSave: () => Promise<void>;
}) {
	return (
		<div className="space-y-4">
			<div className="space-y-1">
				<h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
					Recurring schedule
				</h2>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Choose how often this workspace should run automatically.
				</p>
			</div>

			{currentSchedule ? (
				<div className="flex flex-col gap-3 rounded-[var(--app-radius)] border border-gray-200/80 bg-stone-50 px-4 py-4 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-900 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-center gap-2">
						<Check className="h-4 w-4 text-gray-700 dark:text-gray-300" />
						<span className="break-words text-sm font-medium text-gray-900 dark:text-gray-100">
							Active: {getScheduleLabel(currentSchedule)}
						</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void onDisable()}
						disabled={saving}
						className={cn(
							formSecondaryButtonClassName,
							"h-10 w-auto rounded-[var(--app-radius)] px-4",
						)}
					>
						{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable"}
					</Button>
				</div>
			) : null}

			<div className="space-y-3">
				{SCHEDULE_OPTIONS.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => onSelect(option.value)}
						className={`flex w-full items-center justify-between gap-4 rounded-[var(--app-radius)] ${formPanelClassName} px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
							selected === option.value
								? "border-gray-900 bg-stone-50 dark:border-gray-100 dark:bg-neutral-900"
								: "border-gray-100/80 hover:border-gray-200 hover:bg-stone-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-neutral-900"
						}`}
					>
						<div className="min-w-0">
							<span className="text-sm font-medium text-gray-900 dark:text-gray-100">
								{option.label}
							</span>
							<p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{option.description}
							</p>
						</div>
						<div
							className={cn(
								"flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--app-radius)] border transition-colors",
								selected === option.value
									? "border-gray-900 bg-gray-900 dark:border-gray-100 dark:bg-gray-100"
									: "border-gray-300 dark:border-gray-600",
							)}
						>
							{selected === option.value ? (
								<Check className="h-3 w-3 text-white dark:text-gray-900" />
							) : null}
						</div>
					</button>
				))}
			</div>

			{hasChanges ? (
				<div className="flex justify-stretch pt-1 sm:justify-end">
					<Button
						onClick={() => void onSave()}
						disabled={saving}
						className="gap-2 rounded-[var(--app-radius)] border border-gray-200/70 dark:border-gray-700/80"
					>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save schedule"
						)}
					</Button>
				</div>
			) : null}
		</div>
	);
}

export default function SchedulePageClient({
	appMode,
	workspaceId: initialWorkspaceId,
}: {
	appMode: AppMode;
	workspaceId?: string;
}) {
	const searchParams = useSafeSearchParams();
	const workspaceId = initialWorkspaceId ?? searchParams.get("workspace") ?? "";
	const canConfigureSchedule = canConfigureRecurringScheduleInMode(appMode);
	const [selected, setSelected] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
	const [runJobId, setRunJobId] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const scheduleQuery = api.workspace.getSchedule.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId && canConfigureSchedule },
	);

	const cronTimingQuery = api.workspace.getCronTiming.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId && canConfigureSchedule,
			refetchInterval: 60000,
			refetchIntervalInBackground: false,
		},
	);

	const setScheduleMutation = api.workspace.setSchedule.useMutation();
	const runNowMutation = api.agent.run.useMutation();
	const promptsQuery = api.prompt.fetchUserPrompts.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const selectedPromptsQuery = api.workspace.getSelectedPrompts.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);

	const jobStatusQuery = api.agent.status.useQuery(
		{ workspaceId, jobId: runJobId ?? "" },
		{
			enabled: !!runJobId && isRunning,
			refetchInterval: 3000,
			refetchIntervalInBackground: true,
		},
	);

	useEffect(() => {
		if (!isRunning || !runJobId) return;
		if (jobStatusQuery.data?.status === "completed") {
			clearActiveProviderRun();
			setIsRunning(false);
			setRunJobId(null);
		}
	}, [isRunning, jobStatusQuery.data?.status, runJobId]);

	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	useEffect(() => {
		if (scheduleQuery.data && !hasInitializedSelection) {
			setSelected(scheduleQuery.data.schedule);
			setHasInitializedSelection(true);
		}
	}, [scheduleQuery.data, hasInitializedSelection]);

	const currentSchedule = scheduleQuery.data?.schedule ?? null;
	const hasChanges = selected !== currentSchedule;
	const availablePromptIds =
		promptsQuery.data?.map((prompt) => prompt.id) ?? [];
	const selectedPromptIds =
		selectedPromptsQuery.data?.selectedPromptIds ?? null;
	const effectivePromptIds =
		selectedPromptIds === null ? availablePromptIds : selectedPromptIds;
	const canRunNow = effectivePromptIds.length > 0;

	const handleSave = async () => {
		setSaving(true);
		try {
			const result = await setScheduleMutation.mutateAsync({
				workspaceId,
				schedule: selected,
			});
			setSelected(result.schedule);
			await Promise.all([scheduleQuery.refetch(), cronTimingQuery.refetch()]);
			toast.success(selected ? "Schedule saved." : "Schedule disabled.");
		} catch (err) {
			console.error(err);
			toast.error("Failed to update schedule.");
		} finally {
			setSaving(false);
		}
	};

	const handleDisable = async () => {
		setSaving(true);
		try {
			await setScheduleMutation.mutateAsync({
				workspaceId,
				schedule: null,
			});
			setSelected(null);
			setHasInitializedSelection(true);
			await Promise.all([scheduleQuery.refetch(), cronTimingQuery.refetch()]);
			toast.success("Schedule disabled.");
		} catch (err) {
			console.error(err);
			toast.error("Failed to disable schedule.");
		} finally {
			setSaving(false);
		}
	};

	const handleRunNow = async () => {
		setIsRunning(true);
		try {
			const result = await runNowMutation.mutateAsync({ workspaceId });
			if (result.status === "queued" && result.jobId) {
				persistActiveProviderRun({ workspaceId, jobId: result.jobId });
				setRunJobId(result.jobId);
				return;
			}
			if (result.status === "empty") {
				clearActiveProviderRun();
				setIsRunning(false);
				toast.warning("No prompts configured for this workspace.");
				return;
			}
			if (
				!handleAgentRunResult(result, {
					onDone: () => setIsRunning(false),
				})
			) {
				return;
			}
			clearActiveProviderRun();
			setIsRunning(false);
			toast.error("Failed to start run.");
		} catch (err) {
			console.error(err);
			clearActiveProviderRun();
			setIsRunning(false);
			toast.error("Failed to start run.");
		}
	};

	if (!workspaceId) {
		return (
			<div className="web-centered-state">
				<div className="web-empty-state">
					<p className="text-sm text-gray-500">No workspace selected.</p>
				</div>
			</div>
		);
	}

	if (!canConfigureSchedule) {
		return (
			<div className="web-page-panel max-w-4xl lg:max-w-5xl xl:max-w-6xl space-y-5 sm:space-y-6">
				<ScheduleIntro mode="local" />
				<PromptSelectionCard workspaceId={workspaceId} />
				<ManualRunView
					canRunNow={canRunNow}
					isRunning={isRunning || runNowMutation.isPending}
					onRunNow={handleRunNow}
					mode="local"
				/>
			</div>
		);
	}

	return (
		<div className="web-page-panel max-w-4xl lg:max-w-5xl xl:max-w-6xl space-y-6 sm:space-y-7">
			<ScheduleIntro mode="self-host" />
			<PromptSelectionCard workspaceId={workspaceId} />
			<ManualRunView
				canRunNow={canRunNow}
				isRunning={isRunning || runNowMutation.isPending}
				onRunNow={handleRunNow}
				mode="self-host"
			/>
			{cronTimingQuery.isLoading ? (
				<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
					{TIMING_SKELETON_KEYS.map((key) => (
						<div key={key} className={cn(formPanelClassName, "px-5 py-5")}>
							<Skeleton className="mb-2 h-4 w-24" />
							<Skeleton className="h-6 w-32" />
						</div>
					))}
				</div>
			) : (
				<TimingSummary
					currentSchedule={currentSchedule}
					nextRun={cronTimingQuery.data?.nextRun}
					lastPromptRun={cronTimingQuery.data?.lastPromptRun}
				/>
			)}

			{scheduleQuery.isLoading ? (
				<div className="space-y-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-36" />
						<Skeleton className="h-4 w-64" />
					</div>
					{SCHEDULE_SKELETON_KEYS.map((key) => (
						<div
							key={key}
							className={cn(
								formPanelClassName,
								"flex items-center justify-between px-4 py-4",
							)}
						>
							<div className="space-y-2">
								<Skeleton className="h-4 w-36" />
								<Skeleton className="h-3 w-56" />
							</div>
							<Skeleton className="h-4 w-4 rounded-[var(--app-radius)]" />
						</div>
					))}
				</div>
			) : (
				<ScheduleOptionsSection
					currentSchedule={currentSchedule}
					selected={selected}
					saving={saving}
					hasChanges={hasChanges}
					onSelect={setSelected}
					onDisable={handleDisable}
					onSave={handleSave}
				/>
			)}
		</div>
	);
}
