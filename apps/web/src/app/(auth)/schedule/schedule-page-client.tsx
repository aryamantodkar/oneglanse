"use client";

import {
	formHintClassName,
	formPanelClassName,
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
import { Button, Skeleton, toast } from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import { Calendar, Check, Loader2, PlayCircle } from "lucide-react";
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

function ManualRunView({
	isRunning,
	onRunNow,
	mode,
}: {
	isRunning: boolean;
	onRunNow: () => Promise<void>;
	mode: "local" | "self-host";
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
								Run prompts
							</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Run all providers and get fresh responses on demand.
							</p>
						</div>
					</div>
					<Button
						onClick={() => void onRunNow()}
						disabled={isRunning}
						className="shrink-0"
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
					<span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
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
						Manual run
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Trigger one immediate run without changing the recurring schedule.
					</p>
				</div>
			</div>
			<Button
				onClick={() => void onRunNow()}
				disabled={isRunning}
				className="shrink-0"
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
				{mode === "local" ? "Run prompts" : "Schedule overview"}
			</h2>
			<p className="text-sm text-gray-500 dark:text-gray-400">
				{mode === "local"
					? "Use local mode for clean, on-demand runs while your machine is active."
					: "Manage recurring runs and trigger a manual run whenever you need fresh results."}
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
						className={cn(formSecondaryButtonClassName, "h-10 w-auto px-4")}
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
						className={`flex w-full items-center justify-between gap-4 ${formPanelClassName} px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
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
						className="gap-2"
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
			<div className="web-centered-state">
				<div className="w-full max-w-md">
					<ManualRunView
						isRunning={isRunning || runNowMutation.isPending}
						onRunNow={handleRunNow}
						mode="local"
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="web-page-panel max-w-2xl space-y-6 sm:space-y-7">
			<ScheduleIntro mode="self-host" />
			<ManualRunView
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
