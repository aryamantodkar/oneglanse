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
import { Globe } from "lucide-react";

export default function PromptsDataTable() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [prompts, setPrompts] = useState<string[]>([]);
  const [initialPrompts, setInitialPrompts] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch workspace details
  const {
    data: workspace,
    isLoading: loadingWorkspace,
    error: workspaceError,
  } = api.workspace.getById.useQuery({ workspaceId }, { enabled: !!workspaceId });

  // Fetch user prompts
  const { data, isLoading: loadingPrompts } = api.prompt.fetchUserPrompts.useQuery(
    { workspaceId },
    { retry: 2, refetchOnWindowFocus: false, enabled: !!workspaceId }
  );

  const { data: countries } = api.location.fetchCountries.useQuery();

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

  const storePromptMutation = api.prompt.store.useMutation();
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

  if (loadingWorkspace || loadingPrompts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        Loading...
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-red-500">
        Failed to load workspace
      </div>
    );
  }

  const workspaceLocationMsg = workspace && countries
  ? workspace.country === "GLOBAL"
    ? "This workspace runs prompts globally."
    : workspace.region
    ? `This workspace runs prompts in ${workspace.region}, ${countries.find(c => c.iso2 === workspace.country)?.name}.`
    : `This workspace runs prompts in ${countries.find(c => c.iso2 === workspace.country)?.name}.`
  : "Loading location...";

  const getFlagOrGlobe = () => {
    if (!workspace || !countries) return null;
    if (workspace.country === "GLOBAL") return <Globe className="w-5 h-5 text-gray-500" />;
    const country = countries.find(c => c.iso2 === workspace.country);
    if (!country) return <Globe className="w-5 h-5 text-gray-500" />;
    return <span className="text-lg w-5 h-5 flex items-center justify-center">{country.emoji}</span>;
  };
  

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-4">
        <div className="flex justify-between items-center w-full mb-4">
          <div className="flex gap-2 items-center">

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

          {/* Save Button */}
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

        <div className="flex-1 min-h-0 overflow-y-auto">
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

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm mx-6 mb-4 flex-shrink-0 mb-16">
        {getFlagOrGlobe()}
        <div className="flex flex-col">
          <span className="text-sm text-gray-700">{workspaceLocationMsg}</span>
          <span className="text-xs text-gray-400">You can change it in settings.</span>
        </div>
      </div>
    </div>
  );
}