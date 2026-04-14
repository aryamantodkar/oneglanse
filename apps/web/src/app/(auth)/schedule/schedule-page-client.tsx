"use client";

import {
	formDialogSupportCardClassName,
	formHintClassName,
	formPanelClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type { AppMode } from "@oneglanse/types";
import {
	canConfigureRecurringScheduleInMode,
	canRunPromptsNowInMode,
} from "@oneglanse/types";
import { Button, Skeleton, toast } from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import { Calendar, Check, Clock, Loader2, PlayCircle, Zap } from "lucide-react";
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
	return (
		<div
			className={cn(formPanelClassName, "space-y-4 px-5 py-5 sm:px-6 sm:py-6")}
		>
			<div className={cn(formDialogSupportCardClassName, "space-y-3")}>
				<div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-700 dark:bg-neutral-950/80 dark:text-gray-200">
					<Zap className="h-3.5 w-3.5" />
					{mode === "local" ? "Local Run" : "Manual Run"}
				</div>
				<div className="space-y-1.5">
					<h2 className="text-lg font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100">
						Run Prompts Now
					</h2>
					<p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
						{mode === "local"
							? "Local mode is built for manual runs while your machine is active. Start a fresh run whenever you want updated responses."
							: "Trigger a run immediately outside of your scheduled cadence."}
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{mode === "local" ? (
					<p className={cn(formHintClassName, "max-w-xl text-left")}>
						Recurring schedules are available only in cloud and self-host mode.
					</p>
				) : (
					<span />
				)}
				<Button
					onClick={() => void onRunNow()}
					disabled={isRunning}
					className="w-full gap-2 sm:w-auto"
				>
					{isRunning ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" />
							Running…
						</>
					) : (
						<>
							<PlayCircle className="h-4 w-4" />
							Run Prompts Now
						</>
					)}
				</Button>
			</div>
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
	const canRunNow = canRunPromptsNowInMode(appMode);

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
			setIsRunning(false);
			setRunJobId(null);
			toast.success("Run completed successfully.");
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
				setRunJobId(result.jobId);
				return;
			}
			if (result.status === "empty") {
				setIsRunning(false);
				toast.warning("No prompts configured for this workspace.");
				return;
			}
			setIsRunning(false);
			toast.error("Failed to start run.");
		} catch (err) {
			console.error(err);
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
			<div className="web-page-panel max-w-2xl">
				<div>
					<div className="mb-1 flex items-center gap-2">
						<Clock className="h-5 w-5 text-gray-500" />
						<h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
							Run Prompts
						</h1>
					</div>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Local mode supports on-demand runs while your machine is active.
					</p>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Scheduling is available in the cloud and self-host versions.
					</p>
				</div>
				<div className="flex justify-center pt-3 sm:pt-4">
					<div className="w-full">
						<ManualRunView
							isRunning={isRunning || runNowMutation.isPending}
							onRunNow={handleRunNow}
							mode="local"
						/>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="web-page-panel max-w-2xl">
			<div>
				<div className="mb-1 flex items-center gap-2">
					<Clock className="h-5 w-5 text-gray-500" />
					<h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
						Prompt Schedule
					</h1>
				</div>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Configure recurring prompt runs across your connected AI providers.
				</p>
			</div>

			<>
				{cronTimingQuery.isLoading ? (
					<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
						{TIMING_SKELETON_KEYS.map((key) => (
							<div key={key} className={cn(formPanelClassName, "px-4 py-4")}>
								<Skeleton className="mb-2 h-4 w-24" />
								<Skeleton className="h-6 w-32" />
							</div>
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
						<div className={cn(formPanelClassName, "px-4 py-4")}>
							<div className="mb-1 flex items-center gap-2">
								<Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
									Next Scheduled Run
								</span>
							</div>
							<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
								{currentSchedule && cronTimingQuery.data?.nextRun
									? formatRelativeTime(cronTimingQuery.data.nextRun)
									: "Not scheduled"}
							</p>
						</div>

						<div className={cn(formPanelClassName, "px-4 py-4")}>
							<div className="mb-1 flex items-center gap-2">
								<PlayCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
								<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
									Last Prompt Run
								</span>
							</div>
							<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
								{cronTimingQuery.data?.lastPromptRun
									? formatAbsoluteTime(cronTimingQuery.data.lastPromptRun)
									: "Never"}
							</p>
						</div>
					</div>
				)}

				{scheduleQuery.isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-8 w-48" />
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
								<Skeleton className="h-4 w-4 rounded-full" />
							</div>
						))}
					</div>
				) : (
					<>
						{currentSchedule ? (
							<div className="flex flex-col gap-3 rounded-[24px] border border-blue-200/70 bg-white px-4 py-4 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-blue-900/60 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:justify-between">
								<div className="flex min-w-0 items-center gap-2">
									<Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
									<span className="break-words text-sm font-medium text-blue-900 dark:text-blue-100">
										Active: {getScheduleLabel(currentSchedule)}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleDisable}
									disabled={saving}
									className={cn(
										formSecondaryButtonClassName,
										"h-10 w-auto border-red-200/80 bg-red-50/80 px-4 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50",
									)}
								>
									{saving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Disable"
									)}
								</Button>
							</div>
						) : null}

						<div className="space-y-2">
							<h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Run Prompts
							</h2>
							<div className="space-y-2">
								{SCHEDULE_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => setSelected(option.value)}
										className={`flex w-full items-center justify-between ${formPanelClassName} px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
											selected === option.value
												? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
												: "border-gray-100/80 hover:border-gray-200 hover:bg-stone-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-neutral-900"
										}`}
									>
										<div>
											<span className="text-sm font-medium text-gray-900 dark:text-gray-100">
												{option.label}
											</span>
											<p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
												{option.description}
											</p>
										</div>
										{selected === option.value ? (
											<div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600">
												<Check className="h-3 w-3 text-white" />
											</div>
										) : null}
									</button>
								))}
							</div>
						</div>

						{hasChanges ? (
							<div className="flex justify-stretch sm:justify-end">
								<Button
									onClick={handleSave}
									disabled={saving}
									className="gap-2"
								>
									{saving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Save Schedule"
									)}
								</Button>
							</div>
						) : null}
					</>
				)}
			</>

			{canRunNow && (
				<ManualRunView
					isRunning={isRunning || runNowMutation.isPending}
					onRunNow={handleRunNow}
					mode="self-host"
				/>
			)}
		</div>
	);
}
