"use client";

import { api } from "@/trpc/react";
import { Button, Skeleton, toast } from "@oneglanse/ui";
import { Calendar, Check, Clock, Loader2, PlayCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Helper to convert local hour to UTC hour
function localHourToUTC(localHour: number): number {
	const now = new Date();
	now.setHours(localHour, 0, 0, 0);
	return now.getUTCHours();
}

// Helper to format date to exact date and time (for last run) in local time
function formatAbsoluteTime(timestamp: string | null): string {
	if (!timestamp) return "Never";

	const date = new Date(timestamp);

	// Use browser's local timezone for display
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

// Helper to format date to relative time (for next run)
function formatRelativeTime(timestamp: string | null): string {
	if (!timestamp) return "Not scheduled";

	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	// For past times (shouldn't happen for next run, but handle it)
	if (diffMs < 0) {
		return formatAbsoluteTime(timestamp);
	}

	// For future times
	if (diffMins < 1) {
		return "In less than a minute";
	} else if (diffMins < 60) {
		return `In ${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
	} else if (diffHours < 24) {
		return `In ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
	} else if (diffDays < 7) {
		return `In ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
	} else {
		// For far future times, show absolute
		return formatAbsoluteTime(timestamp);
	}
}

// Generate schedule options based on user's local timezone
function getScheduleOptions() {
	return [
		{
			label: "Every 12 hours",
			value: "0 */12 * * *",
			description: `Runs twice daily starting at midnight`,
		},
		{
			label: "Every day at midnight",
			value: `0 ${localHourToUTC(0)} * * *`,
			description: `Runs daily at midnight`,
		},
		{
			label: "Every 2 days at midnight",
			value: `0 ${localHourToUTC(0)} */2 * *`,
			description: `Runs every other day at midnight`,
		},
		{
			label: "Every week (Sunday midnight)",
			value: `0 ${localHourToUTC(0)} * * 0`,
			description: `Runs every Sunday at midnight`,
		},
	];
}

const SCHEDULE_OPTIONS = getScheduleOptions();

function getScheduleLabel(cron: string | null): string {
	if (!cron) return "Not scheduled";
	const match = SCHEDULE_OPTIONS.find((opt) => opt.value === cron);
	return match?.label ?? cron;
}

export default function SchedulePage(): React.JSX.Element {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const [selected, setSelected] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const scheduleQuery = api.workspace.getSchedule.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);

	const cronTimingQuery = api.workspace.getCronTiming.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId, refetchInterval: 30000 }, // Refetch every 30 seconds
	);

	const setScheduleMutation = api.workspace.setSchedule.useMutation();

	// Sync selected state with fetched schedule
	useEffect(() => {
		if (scheduleQuery.data) {
			setSelected(scheduleQuery.data.schedule);
		}
	}, [scheduleQuery.data]);

	const currentSchedule = scheduleQuery.data?.schedule ?? null;
	const hasChanges = selected !== currentSchedule;

	const handleSave = async () => {
		setSaving(true);
		try {
			await setScheduleMutation.mutateAsync({
				workspaceId,
				schedule: selected,
			});
			await Promise.all([scheduleQuery.refetch(), cronTimingQuery.refetch()]);
			toast.success(
				selected
					? "Schedule saved! Your prompts will run shortly."
					: "Schedule disabled",
			);
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
			await Promise.all([scheduleQuery.refetch(), cronTimingQuery.refetch()]);
			toast.success("Schedule disabled.");
		} catch (err) {
			console.error(err);
			toast.error("Failed to disable schedule.");
		} finally {
			setSaving(false);
		}
	};

	if (!workspaceId) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<p className="text-sm text-gray-500">No workspace selected.</p>
			</div>
		);
	}

	return (
		<div className="ui-page-enter ui-stagger mx-auto max-w-2xl space-y-8 py-6">
			{/* Header */}
			<div>
				<div className="flex items-center gap-2 mb-1">
					<Clock className="h-5 w-5 text-gray-500" />
					<h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
						Prompt Schedule
					</h1>
				</div>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Configure how often your prompts are automatically run across all AI
					providers and analyzed.
				</p>
			</div>

			{/* Timing Information Cards */}
			{cronTimingQuery.isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{Array.from({ length: 2 }).map((_, idx) => (
						<div
							key={`timing-skeleton-${idx}`}
							className="rounded-lg border border-gray-200 px-4 py-3"
						>
							<Skeleton className="h-4 w-24 mb-2" />
							<Skeleton className="h-6 w-32" />
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Next Scheduled Run */}
					<div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
						<div className="flex items-center gap-2 mb-1">
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

					{/* Last Prompt Run (Manual or Scheduled) */}
					<div className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
						<div className="flex items-center gap-2 mb-1">
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

			{/* Current status */}
			{scheduleQuery.isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-8 w-48" />
					{Array.from({ length: 4 }).map((_, idx) => (
						<div
							key={`schedule-skeleton-${idx}`}
							className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
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
					{currentSchedule && (
						<div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/20">
							<div className="flex items-center gap-2">
								<Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span className="text-sm font-medium text-blue-900 dark:text-blue-100">
									Active: {getScheduleLabel(currentSchedule)}
								</span>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleDisable}
								disabled={saving}
								className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
							>
								{saving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Disable"
								)}
							</Button>
						</div>
					)}

					{/* Schedule options */}
					<div className="space-y-2">
						<h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
							Run prompts
						</h2>
						<div className="space-y-2">
							{SCHEDULE_OPTIONS.map((option) => (
								<button
									key={option.value}
									onClick={() => setSelected(option.value)}
									className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
										selected === option.value
											? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
											: "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
									}`}
								>
									<div>
										<span className="text-sm font-medium text-gray-900 dark:text-gray-100">
											{option.label}
										</span>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											{option.description}
										</p>
									</div>
									{selected === option.value && (
										<div className="h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
											<Check className="h-3 w-3 text-white" />
										</div>
									)}
								</button>
							))}
						</div>
					</div>

					{/* Save button */}
					{hasChanges && (
						<div className="flex flex-col items-end gap-2">
							<Button onClick={handleSave} disabled={saving} className="gap-2">
								{saving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Save Schedule"
								)}
							</Button>
							<p className="text-xs text-gray-400 dark:text-gray-500">
								Prompts will run immediately and then follow the selected
								schedule.
							</p>
						</div>
					)}
				</>
			)}
		</div>
	);
}
