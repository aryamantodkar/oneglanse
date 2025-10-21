"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function PromptsDataTable() {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [initialPrompts, setInitialPrompts] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const storePromptMutation = api.prompt.store.useMutation();

  // Fetch user prompts
  const { data, isLoading: loadingPrompts } = api.prompt.fetchUserPrompts.useQuery(
    { workspaceId },
    { retry: 2, refetchOnWindowFocus: false, enabled: !!workspaceId }
  );

  useEffect(() => {
    if (data?.prompts) {
      setPrompts(data.prompts);
      setInitialPrompts(data.prompts);
    }
  }, [data]);

  const addPrompt = (prompt: string) => {
    if (!prompt.trim()) return;
    setPrompts([...prompts, prompt.trim()]);
  };

  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) newSet.delete(idx);
      else newSet.add(idx);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!workspaceId) {
      toast.error("Workspace ID not available yet. Please try refreshing the page.");
      return;
    }
    
    setLoading(true);
    try {
      await storePromptMutation.mutateAsync({ prompts, workspaceId });
      setInitialPrompts(prompts);
      setSelectedRows(new Set());

      toast.success("Prompts saved successfully!");
    } catch (err) {
      console.error("Failed to save prompts:", err);

      toast.error("Failed to save prompts");
    } finally {
      setLoading(false);
    }
  };

  const newChanges =
    prompts.length !== initialPrompts.length ||
    prompts.some((p, idx) => p !== initialPrompts[idx]);

  const handleAddPrompt = () => {
    addPrompt(currentPrompt);
    setCurrentPrompt("");
    setDialogOpen(false);
  };

  if (loadingPrompts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        Loading prompts...
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen px-6 py-4">
      {/* Top Add, Delete & Save Buttons */}
      <div className="flex justify-between items-center w-full mb-4">
        {/* Left buttons: Add & Delete */}
        <div className="flex gap-2 items-center">
          {/* Add Prompt Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="p-2 rounded-xl">
                <Plus size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Prompt</DialogTitle>
              </DialogHeader>
              <Textarea
                placeholder="Type your prompt..."
                className="w-full mt-2"
                rows={4}
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPrompt}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Selected */}
          {selectedRows.size > 0 && (
            <Button
              variant="outline"
              className="p-2 rounded-xl hover:bg-red-50 text-red-600 transition"
              onClick={() => {
                setPrompts((prev) =>
                  prev.filter((_, idx) => !selectedRows.has(idx))
                );
                setSelectedRows(new Set());
              }}
            >
              <Trash2 size={20} />
            </Button>
          )}
        </div>

        {/* Save Button at extreme right */}
        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={loading || !newChanges}
            className={`py-2 rounded-xl transition ${
              loading || !newChanges
                ? "bg-transparent text-gray-400 border border-gray-300 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="w-full">
      <Table className="w-full border border-gray-200 rounded-xl table-auto">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="pl-4 w-12">
                <Checkbox
                  checked={selectedRows.size === prompts.length && prompts.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRows(new Set(prompts.map((_, idx) => idx)));
                    } else {
                      setSelectedRows(new Set());
                    } 
                  }}
                />
              </TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Sentiment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((prompt, idx) => (
              <TableRow
                key={idx}
                className={`hover:bg-gray-50 cursor-pointer ${
                  selectedRows.has(idx) ? "bg-gray-100" : ""
                }`}
                onClick={() => toggleRow(idx)}
              >
                <TableCell className="pl-4">
                  <Checkbox checked={selectedRows.has(idx)} />
                </TableCell>
                <TableCell className="max-w-[400px] whitespace-normal break-words">{prompt}</TableCell>
                <TableCell>Public</TableCell>
                <TableCell>Neutral</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}