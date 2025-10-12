"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function CronPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("* * * * *");
  const [maxAttempts, setMaxAttempts] = useState(3);

  const { data: jobs, refetch } = api.cron.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const createCron = api.cron.create.useMutation({
    onSuccess: () => {
      toast.success("Cron job saved!");
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCron = api.cron.update.useMutation({
    onSuccess: () => {
      toast.success("Cron job updated!");
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCron = api.cron.delete.useMutation({
    onSuccess: () => {
      toast.success("Cron job deleted!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const payload = { type: "runPrompts" }; // hardcoded internal job payload
  
    if (editingJobId) {
      // Updating existing job
      updateCron.mutate({
        jobId: editingJobId,
        name,
        cronExpression,
        maxAttempts,
      });
    } else {
      // Creating new job
      createCron.mutate({
        workspaceId,
        name,
        cronExpression,
        targetType: "internal",
        targetPayload: payload,
        maxAttempts,
      });
    }
  };

  const handleEdit = (job: any) => {
    setEditingJobId(job.id);
    setName(job.name || "");
    setCronExpression(job.cronExpression);
    setMaxAttempts(job.maxAttempts ?? 3);
  };

  const resetForm = () => {
    setEditingJobId(null);
    setName("");
    setCronExpression("* * * * *");
    setMaxAttempts(3);
  };

  return (
    <div className="min-h-screen p-6 space-y-8 max-w-7xl mx-auto">
      {/* Create / Edit Form (Full Width) */}
      <Card className="w-full shadow-lg border border-gray-200">
        <CardHeader>
          <CardTitle>
            {editingJobId ? "Edit Cron Job" : "Create New Cron Job"}
          </CardTitle>
          <CardDescription>
            Schedule automated tasks for your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            {Label && <Label htmlFor="cron-name">Job Name</Label>}
            <Input
              id="cron-name"
              placeholder="Enter a descriptive name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Give your cron job a name so you can identify it easily.
            </p>
          </div>

          <div className="space-y-1">
            {Label && <Label htmlFor="cron-expression">Cron Expression</Label>}
            <Input
              id="cron-expression"
              placeholder="* * * * *"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
            />
            <p className="text-sm text-gray-500 font-mono">
              Use standard cron syntax (e.g., * * * * * for every minute).
            </p>
          </div>

          <div className="space-y-1">
            {Label && <Label htmlFor="max-attempts">Max Attempts</Label>}
            <Input
              id="max-attempts"
              type="number"
              min={1}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
            <p className="text-sm text-gray-500">
              Number of retry attempts if the job fails.
            </p>
          </div>

          <div className="flex gap-3 mt-2 justify-end">
            {editingJobId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit}>
              {editingJobId ? "Update Cron Job" : "Create Cron Job"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Jobs */}
      {jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job: any) => (
            <Card
              key={job.id}
              className="hover:shadow-lg transition-shadow border border-gray-100"
            >
              <CardHeader>
                <CardTitle>{job.name || "(No Name)"}</CardTitle>
                <CardDescription>
                  {job.cronExpression} | {job.targetType}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(job)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteCron.mutate({ jobId: job.id })}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 space-y-2">
          <p className="text-lg">No cron jobs configured yet.</p>
          <p className="text-gray-400">
            Use the form above to create your first cron job.
          </p>
        </div>
      )}
    </div>
  );
}