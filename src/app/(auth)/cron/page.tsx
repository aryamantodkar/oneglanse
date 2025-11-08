"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function CronPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";
  
  const [prompts, setPrompts] = useState<string[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("* * * * *");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [open, setOpen] = useState(false);

  const { data: jobs, refetch } = api.cron.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const { data: userPrompts, isLoading: loadingPrompts } =
    api.prompt.fetchUserPrompts.useQuery(
      { workspaceId },
      { retry: 2, refetchOnWindowFocus: false, enabled: !!workspaceId }
    );

  useEffect(() => {
    if (userPrompts?.data) {
      const initial = userPrompts?.data.map((p: any) => p.prompt);
      setPrompts(initial);
    }
  }, [userPrompts]);
  
  const createCron = api.cron.create.useMutation({
    onSuccess: () => {
      toast.success("Cron job saved!");
      resetForm();
      refetch();
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCron = api.cron.update.useMutation({
    onSuccess: () => {
      toast.success("Cron job updated!");
      resetForm();
      refetch();
      setOpen(false);
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
    const payload = { type: "runPrompts" };

    if (editingJobId) {
      updateCron.mutate({
        jobId: editingJobId,
        name,
        cronExpression,
        maxAttempts,
      });
    } else {
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
    setOpen(true);
  };

  const resetForm = () => {
    setEditingJobId(null);
    setName("");
    setCronExpression("* * * * *");
    setMaxAttempts(3);
    setOpen(false);
  };

  if (loadingPrompts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        Loading cron jobs...
      </div>
    );
  }

  if (!prompts || prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4 text-gray-500">
        <div>
          <p className="text-lg font-medium">You haven’t added any prompts yet.</p>
          <p className="text-gray-400 max-w-md mx-auto">
            Create prompts first before scheduling cron jobs to automate them.
          </p>
        </div>
  
        <Button asChild>
          <a href={`/prompts?workspace=${workspaceId}`} className="text-white">
            Go to Prompts
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-8 py-6 space-y-6">
      {/* Top Create Button */}
      <div className="flex justify-start mb-6">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="default">Create New Cron Job</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingJobId ? "Edit Cron Job" : "Create Cron Job"}
              </DialogTitle>
              <DialogDescription>
                Schedule automated tasks for your workspace.
              </DialogDescription>
            </DialogHeader>
  
            {/* Form */}
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label htmlFor="cron-name">Job Name</Label>
                <Input
                  id="cron-name"
                  placeholder="Enter a descriptive name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
  
              <div className="space-y-1">
                <Label htmlFor="cron-expression">Cron Expression</Label>
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
                <Label htmlFor="max-attempts">Max Attempts</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={1}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
  
              <div className="flex gap-3 justify-end">
                {editingJobId && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button onClick={handleSubmit}>
                  {editingJobId ? "Update Cron Job" : "Create Cron Job"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  
      {/* Existing Jobs Table */}
      <div className="w-full overflow-x-auto">
        {jobs?.data && jobs?.data.length > 0 ? (
          <Table className="min-w-full border rounded-md border-gray-200">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Name</TableHead>
                <TableHead>Cron Expression</TableHead>
                <TableHead>Max Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.data.map((job: any) => (
                <TableRow
                  key={job.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <TableCell className="font-medium">{job.name || "(No Name)"}</TableCell>
                  <TableCell className="font-mono">{job.cronExpression}</TableCell>
                  <TableCell>{job.maxAttempts}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(job)}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteCron.mutate({ jobId: job.id })}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500 space-y-2">
            <p className="text-lg">No cron jobs configured yet.</p>
            <p className="text-gray-400">
              Use the "Create New Cron Job" button above to add one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}