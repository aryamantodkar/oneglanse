"use client";

import { useEffect, useState, useMemo, type JSX } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PromptsDataTable() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [prompts, setPrompts] = useState<string[]>([]);
  const [initialPrompts, setInitialPrompts] = useState<string[]>([]);
  const [perModelData, setPerModelData] = useState<
    Record<
      string,
      {
        [model: string]: {
          sentiment: number;
          position: number;
          visibility: number;
          topFavicons: string[];
          brandMetrics?: Record<
            string,
            { sentiment: number; visibility: number; position: number }
          >;
        };
      }
    >
  >({});
  const [modelFilter, setModelFilter] = useState("All Models");
  const [brandFilter, setBrandFilter] = useState("All Brands");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const { data } = api.prompt.fetchUserPrompts.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const storePromptMutation = api.prompt.store.useMutation();
  const analyzeMetricsMutation = api.analysis.analyzeMetrics.useMutation();

  // Load prompts and per-model data
  useEffect(() => {
    if (data?.prompts) {
      const fetchedPrompts = data.prompts.map((p) => p.prompt);
      setPrompts(fetchedPrompts);
      setInitialPrompts(fetchedPrompts);
      const modelMap: typeof perModelData = {};
      data.prompts.forEach((p) => (modelMap[p.prompt] = p.per_model ?? {}));
      setPerModelData(modelMap);
    }

    analyzeMetricsMutation.mutate(
      { workspaceId },
      {
        onSuccess: (res) => {
          const newMap: typeof perModelData = {};
          res.prompts.forEach((rp: any) => {
            newMap[rp.prompt] = rp.per_model ?? {};
          });
          setPerModelData(newMap);
          console.log("Background analysis complete");
        },
        onError: (err) => console.error("Background analysis failed", err),
      }
    );
  }, [data]);

  const isModified = useMemo(() => {
    if (prompts.length !== initialPrompts.length) return true;
    return prompts.some((p, i) => p !== initialPrompts[i]);
  }, [prompts, initialPrompts]);

  // Models and brands for filters
  const models = useMemo(() => {
    const set = new Set<string>();
    Object.values(perModelData).forEach((m) =>
      Object.keys(m).forEach((k) => set.add(k))
    );
    return ["All Models", ...Array.from(set)];
  }, [perModelData]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    Object.values(perModelData).forEach((m) =>
      Object.values(m).forEach((metrics) => {
        Object.keys(metrics.brandMetrics ?? {}).forEach((b) => set.add(b));
      })
    );
    return ["All Brands", ...Array.from(set)];
  }, [perModelData]);

  const handleAddPrompt = () => {
    if (!currentPrompt.trim()) return;
    setPrompts([...prompts, currentPrompt.trim()]);
    setCurrentPrompt("");
    setDialogOpen(false);
  };

  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      newSet.has(idx) ? newSet.delete(idx) : newSet.add(idx);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!workspaceId) return toast.error("Workspace ID not available");

    setLoading(true);
    try {
      await storePromptMutation.mutateAsync({
        prompts,
        workspaceId,
      });
      setInitialPrompts(prompts);
      toast.success("Prompts saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save prompts");
    } finally {
      setLoading(false);
    }
  };

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      if (modelFilter !== "All Models" && !perModelData[p]?.[modelFilter]) return false;
      if (brandFilter === "All Brands") return true;

      const modelsForPrompt = Object.values(perModelData[p] ?? {});
      return modelsForPrompt.some((m) =>
        Object.keys(m.brandMetrics ?? {}).includes(brandFilter)
      );
    });
  }, [prompts, perModelData, modelFilter, brandFilter]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 py-4">
        <div className="flex justify-between items-center mb-4 gap-2">
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
                rows={4}
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                className="w-full mt-2"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPrompt}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete */}
          {selectedRows.size > 0 && (
            <Button
              variant="outline"
              className="p-2 rounded-xl text-red-600 hover:bg-red-50"
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

          {/* Model Filter */}
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Brand Filter */}
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={loading || !isModified}
            className={`py-2 rounded-xl transition ${
              loading || !isModified
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredPrompts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No prompts added yet. Click <Plus className="inline w-4 h-4 mx-1" /> to add one.
            </div>
          ) : (
            <Table className="w-full border border-gray-200 rounded-xl table-auto">
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="pl-4 w-12">
                    <Checkbox
                      checked={
                        selectedRows.size === filteredPrompts.length &&
                        filteredPrompts.length > 0
                      }
                      onCheckedChange={(checked) => {
                        if (checked)
                          setSelectedRows(new Set(filteredPrompts.map((_, idx) => idx)));
                        else setSelectedRows(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Top</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredPrompts.map((prompt, idx) => {
                  const perModel = perModelData[prompt] ?? {};
                  const modelEntries = Object.entries(perModel);

                  // If no metrics exist, render a single row for the prompt
                  if (modelEntries.length === 0) {
                    return (
                      <TableRow key={prompt} className="hover:bg-gray-50 cursor-pointer">
                        <TableCell className="pl-4">
                          <Checkbox checked={selectedRows.has(idx)} />
                        </TableCell>
                        <TableCell>{prompt}</TableCell>
                        <TableCell colSpan={6} className="text-gray-400">
                          No metrics yet
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // If metrics exist, render per model & per brand
                  const rows: JSX.Element[] = [];
                  modelEntries.forEach(([modelName, metrics]) => {
                    const brandMetrics = metrics.brandMetrics ?? {};
                    // If no brand metrics, render model-level row
                    if (Object.keys(brandMetrics).length === 0) {
                      rows.push(
                        <TableRow key={`${prompt}-${modelName}`} className="hover:bg-gray-50 cursor-pointer">
                          <TableCell className="pl-4">
                            <Checkbox checked={selectedRows.has(idx)} />
                          </TableCell>
                          <TableCell>{prompt}</TableCell>
                          <TableCell>{modelName}</TableCell>
                          <TableCell colSpan={4} className="text-gray-400">
                            No brand metrics yet
                          </TableCell>
                          <TableCell className="flex gap-1">
                            {metrics.topFavicons?.map((f) => (
                              <img key={f} src={f} className="w-5 h-5 rounded-sm" />
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                      return;
                    }

                    // Render rows per brand
                    Object.entries(brandMetrics).forEach(([brandName, brandMetric]) => {
                      if (brandFilter !== "All Brands" && brandName !== brandFilter) return;

                      rows.push(
                        <TableRow
                          key={`${prompt}-${modelName}-${brandName}`}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <TableCell className="pl-4">
                            <Checkbox checked={selectedRows.has(idx)} />
                          </TableCell>
                          <TableCell>{prompt}</TableCell>
                          <TableCell>{modelName}</TableCell>
                          <TableCell>{brandName}</TableCell>
                          <TableCell>{brandMetric.sentiment}</TableCell>
                          <TableCell>{brandMetric.visibility}%</TableCell>
                          <TableCell>{brandMetric.position}</TableCell>
                          <TableCell className="flex gap-1">
                            {metrics.topFavicons?.map((f) => (
                              <img key={f} src={f} className="w-5 h-5 rounded-sm" />
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  });

                  return rows;
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}