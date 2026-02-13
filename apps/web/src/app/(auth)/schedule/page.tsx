"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Skeleton, toast } from "@onescope/ui";
import { Clock, Loader2, Check } from "lucide-react";
import { api } from "@/trpc/react";

const SCHEDULE_OPTIONS = [
  { label: "Every 6 hours", value: "0 */6 * * *", description: "Runs at midnight, 6 AM, noon, and 6 PM" },
  { label: "Every 12 hours", value: "0 */12 * * *", description: "Runs at midnight and noon" },
  { label: "Every day", value: "0 0 * * *", description: "Runs once daily at midnight" },
  { label: "Every 2 days", value: "0 0 */2 * *", description: "Runs at midnight every other day" },
  { label: "Every week", value: "0 0 * * 0", description: "Runs every Sunday at midnight" },
] as const;

function getScheduleLabel(cron: string | null): string {
  if (!cron) return "Not scheduled";
  const match = SCHEDULE_OPTIONS.find((opt) => opt.value === cron);
  return match?.label ?? cron;
}

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scheduleQuery = api.workspace.getSchedule.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const setScheduleMutation = api.workspace.setSchedule.useMutation();

  // Sync selected state with fetched schedule
  useEffect(() => {
    if (scheduleQuery.data?.data) {
      setSelected(scheduleQuery.data.data.schedule);
    }
  }, [scheduleQuery.data]);

  const currentSchedule = scheduleQuery.data?.data?.schedule ?? null;
  const hasChanges = selected !== currentSchedule;

  const handleSave = async () => {
    setSaving(true);
    try {
      await setScheduleMutation.mutateAsync({
        workspaceId,
        schedule: selected,
      });
      await scheduleQuery.refetch();
      toast.success(
        selected
          ? "Schedule saved! Your prompts will run shortly."
          : "Schedule disabled"
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
      await scheduleQuery.refetch();
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
          Configure how often your prompts are automatically run across all AI providers and analyzed.
        </p>
      </div>

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
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable"}
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
                Prompts will run immediately and then follow the selected schedule.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
