"use client";

import { useEffect, useState, useMemo, type JSX, useCallback } from "react";
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
  DialogDescription,
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
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMarkdown, getModelFavicon } from "@/lib/helper/functions";
import { PositionCell, SentimentCell } from "@/lib/helper/ui";
import { fetchUserPrompts, useStorePrompt, useAnalyzeMetrics } from "@/lib/helper/mutations";
import type { PromptMetric, Metric } from "@/server/db/types";

export default function PromptsDataTable() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [initialPrompts, setInitialPrompts] = useState<PromptMetric[]>([]);
  const [modelFilter, setModelFilter] = useState("All Models");
  const [brandFilter, setBrandFilter] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<PromptMetric[]>([]);
  const [openPrompt, setOpenPrompt] = useState<null | typeof promptData[0]>(null);

  const { data: userPrompts, isLoading, error } = fetchUserPrompts(workspaceId);
  const storePromptMutation = useStorePrompt();
  const analyzeMetricsMutation = useAnalyzeMetrics();

  useEffect(() => {
    if (userPrompts?.data?.length) {
      // analyzeMetricsMutation.mutate(
      //   { workspaceId },
      //   {
      //     onSuccess: (res) => {
      //       console.log("Background analysis complete ✅");
      //     },
      //     onError: (err) => {
      //       console.error("Background analysis failed ❌", err);
      //     },
      //   }
      // );

      const filteredRows: PromptMetric[] = userPrompts?.data.map((p) => {
        const perModelRaw =
          typeof p.per_model === "string"
            ? JSON.parse(p.per_model)
            : (p.per_model as any) || {};
      
        // Prepare outputs
        const topPerModel: Record<string, Record<string, Metric>> = {};
        const modelResponses: Record<string, string> = {};
      
        // Step 1: Extract brandMetrics + response
        Object.entries(perModelRaw).forEach(([model, modelData]) => {
          if (!modelData || typeof modelData !== "object") return;
      
          const brandMetrics = (modelData as { brandMetrics?: Record<string, Metric> })
            .brandMetrics || {};
      
          const response = (modelData as { response?: string }).response || "";
          modelResponses[model] = response;
      
          // Sort brands by position
          const sortedBrands = Object.entries(brandMetrics).sort(
            ([_aName, aMetrics], [_bName, bMetrics]) => {
              const aPos =
                typeof aMetrics.position === "number"
                  ? aMetrics.position
                  : Number(aMetrics.position) || 0;
              const bPos =
                typeof bMetrics.position === "number"
                  ? bMetrics.position
                  : Number(bMetrics.position) || 0;
              return aPos - bPos;
            }
          );
      
          // Rebuild ranked list
          const ranked = sortedBrands.map(([brand, metrics], index) => [
            brand,
            { ...metrics, position: index + 1 },
          ]);
      
          topPerModel[model] = Object.fromEntries(ranked);
        });
      
        // Step 2: Collect all brands across models
        const allBrands = Array.from(
          new Set(
            Object.values(topPerModel)
              .flatMap((brands) => Object.keys(brands))
              .filter(Boolean)
          )
        );
      
        // Step 3: Compute “All Models” averages
        const brandAverages: Record<string, Metric> = Object.fromEntries(
          allBrands.map<[string, Metric]>((brand) => {
            const modelMetrics = Object.values(topPerModel)
              .map((brands) => brands[brand])
              .filter((m): m is Metric => Boolean(m));
        
            // If no data, initialize with empty Metric
            if (modelMetrics.length === 0) {
              return [
                brand,
                {
                  mentions: "-",
                  sentiment: "-",
                  visibility: "-",
                  position: "-",
                  website: "",
                },
              ];
            }
        
            const avg = (key: keyof Metric): number =>
              modelMetrics.reduce((sum, m) => sum + Number(m?.[key] ?? 0), 0) /
              modelMetrics.length;
        
            return [
              brand,
              {
                mentions: Math.round(avg("mentions")),
                sentiment: Number(avg("sentiment").toFixed(1)),
                visibility: Number(avg("visibility").toFixed(1)),
                position: Number(avg("position").toFixed(1)),
                website: modelMetrics[0]?.website ?? "",
              },
            ];
          })
        );

        return {
          ...p,
          per_model: {
            ...topPerModel,
            "All Models": brandAverages,
          },
          responses: modelResponses,
        };
      });

      console.log("filteredRows", filteredRows);
      setPromptData(filteredRows);
      setInitialPrompts(filteredRows);
    }
  }, [userPrompts]);

  const allBrands = useMemo(() => {
    const brands = new Set<string>();

  
    userPrompts?.data?.forEach((p) => {
      Object.values(p.per_model || {}).forEach((modelData: any) => {
        const brandMetrics = modelData?.brandMetrics || {};
        Object.keys(brandMetrics).forEach((b) => brands.add(b));
      });
    });
  
    return Array.from(brands);
  }, [userPrompts]);
  
  const models = useMemo(() => {
    const sample = userPrompts?.data?.[0];
    const perModel = sample?.per_model || {};
    return ["All Models", ...Object.keys(perModel)];
  }, [userPrompts]);

  useEffect(() => {
    if (allBrands.length > 0 && brandFilter === "") {
      setBrandFilter(allBrands[0] ?? "");
    }
  }, [allBrands, brandFilter]);

  const isModified = useMemo(() => {
    if (promptData.length !== initialPrompts.length) return true;
    return promptData.some((p, i) => p !== initialPrompts[i]);
  }, [promptData, initialPrompts]);

  const handleAddPrompt = () => {
    if (!currentPrompt.trim()) return;
    
    setPromptData([
      ...promptData,
      {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_id: "",          
        workspace_id: workspaceId ?? "",   
        prompt: currentPrompt.trim(),
        per_model: {},
        responses: {},      
      },
    ]);
    
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
      const prompts = promptData.map(metrics => metrics.prompt)
      await storePromptMutation.mutateAsync({ prompts, workspaceId });
      setInitialPrompts(promptData);
      toast.success("Prompts saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save prompts");
    } finally {
      setLoading(false);
    }
  };

  const getBrandWebsite = useCallback(
    (brand: string): string => {
      if (!promptData || promptData.length === 0) return "";
  
      for (const p of promptData) {
        const perModel = p.per_model || {};
        for (const [model, brands] of Object.entries(perModel)) {
          const brandData = (brands as Record<string, Metric | undefined>)[brand];
          if (brandData?.website) return brandData.website;
        }
      }
  
      return "";
    },
    [promptData]
  );

  return(
    <div className="flex flex-col h-screen">
      {/* Header Controls */}
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex gap-3 items-center">
          {/* Add Prompt */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="p-2 rounded-xl">
                <Plus size={18} />
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

          {/* Delete Selected */}
          {selectedRows.size > 0 && (
            <Button
              variant="outline"
              className="p-2 rounded-xl text-red-600 hover:bg-red-50"
              onClick={() => {
                setPromptData((prev) => prev.filter((_, i) => !selectedRows.has(i)));
                setSelectedRows(new Set());
              }}
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={loading || !isModified}
          className={`py-2 px-6 rounded-xl transition ${
            loading || !isModified
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-4 py-6">
          {/* Model Filter */}
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-44 h-10 text-sm border border-gray-200 rounded-lg bg-white dark:bg-transparent dark:border-gray-800">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  <div className="flex items-center gap-2">
                    {m === "All Models" ? (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <img
                        src={getModelFavicon(m)}
                        alt={m}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    <span>{m}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Brand Filter */}
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-44 h-10 text-sm border border-gray-200 rounded-lg bg-white dark:bg-transparent dark:border-gray-800">
              <SelectValue placeholder="Select Brand" />
            </SelectTrigger>
            <SelectContent>
              {allBrands.map((b) => {
                const website = getBrandWebsite(b);
                const favicon = website
                  ? `https://www.google.com/s2/favicons?sz=32&domain=${new URL(
                      website
                    ).hostname}`
                  : "";
                return (
                  <SelectItem key={b} value={b}>
                    <div className="flex items-center gap-2">
                      {favicon && (
                        <img src={favicon} alt={b} className="w-4 h-4 rounded" />
                      )}
                      <span>{b}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-50/70 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                <TableHead className="pl-4 w-12">
                  <Checkbox
                    checked={
                      selectedRows.size === promptData.length &&
                      promptData.length > 0
                    }
                    onCheckedChange={(checked) => {
                      if (checked)
                        setSelectedRows(new Set(promptData.map((_, idx) => idx)));
                      else setSelectedRows(new Set());
                    }}
                  />
                </TableHead>
                <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-left">
                  Prompt
                </TableHead>
                <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-center">
                  Mentions
                </TableHead>
                <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-center">
                  Sentiment
                </TableHead>
                <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-center">
                  Visibility
                </TableHead>
                <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-center">
                  Position
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {promptData.map((prompt, idx) => {
                let metrics = prompt?.per_model?.[modelFilter]?.[brandFilter];
                if (!metrics) {
                  metrics = {
                    mentions: "-",
                    sentiment: "-",
                    visibility: "-",
                    position: "-",
                  };
                }

                return (
                  <TableRow
                    key={prompt.id}
                    onClick={() => setOpenPrompt(prompt)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors border-b border-gray-100/50 dark:border-gray-800/40 last:border-none"
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedRows.has(idx)}
                        onCheckedChange={() => toggleRow(idx)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>

                    <TableCell className="px-6 py-5 text-sm text-gray-800 dark:text-gray-200 leading-relaxed max-w-2xl">
                      {prompt.prompt}
                    </TableCell>

                    <TableCell className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300 text-center">
                      {metrics.mentions !== "-"
                        ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 text-xs font-medium">
                              {metrics.mentions}
                            </span>
                          )
                        : (
                            <span className="text-gray-400">-</span>
                          )}
                    </TableCell>

                    <TableCell className="px-6 py-5 text-center">
                      <SentimentCell sentiment={metrics.sentiment} />
                    </TableCell>

                    <TableCell className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300 text-center">
                      {metrics.visibility !== "-"
                        ? (
                            <span className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-2 py-1 text-xs font-medium">
                              {metrics.visibility}%
                            </span>
                          )
                        : (
                            <span className="text-gray-400">-</span>
                          )}
                    </TableCell>

                    <TableCell className="px-6 py-5 text-center">
                      <PositionCell position={metrics.position} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Dialog open={!!openPrompt} onOpenChange={() => setOpenPrompt(null)}>
            <DialogContent
              className="!max-w-[90vw] !w-[90vw] sm:!max-w-[80vw] sm:!w-[80vw] rounded-2xl px-8 pb-8 sm:px-10 sm:pt-12 sm:pb-10 space-y-4"
            >
              <DialogHeader className="mb-4">
                {/* ✅ Hidden accessible title */}
                <DialogTitle className="sr-only">
                  {openPrompt?.prompt || "Prompt Details"}
                </DialogTitle>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 min-w-0 break-words">
                    {openPrompt?.prompt}
                  </h2>

                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="w-44 h-9 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 shrink-0">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>
                          <div className="flex items-center gap-2">
                            {m === "All Models" ? (
                              <Bot className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <img
                                src={getModelFavicon(m)}
                                alt={m}
                                className="w-4 h-4 rounded-sm"
                              />
                            )}
                            <span>{m}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DialogHeader>

              {/* ✅ Hidden accessible description */}
              <DialogDescription className="sr-only">
                This dialog shows AI model responses for the selected prompt.
              </DialogDescription>

              <ScrollArea className="max-h-[75vh] pr-4">
                {openPrompt && (
                  <div className="flex flex-col gap-6">
                    {modelFilter === "All Models" ? (
                      Object.entries(openPrompt.responses || {}).map(([model, response]) => (
                        <div
                          key={model}
                          className="flex items-start gap-4 mb-6 last:mb-0"
                        >
                          <img
                            src={getModelFavicon(model)}
                            alt={model}
                            className="w-8 h-8 rounded-md flex-shrink-0"
                          />

                          <div className="max-w-[75%] p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-800 dark:text-gray-100 text-md tracking-tight">
                                {model}
                              </span>
                            </div>
                            <div
                              className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: formatMarkdown(response) }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start gap-3">
                        {getModelFavicon(modelFilter) ? (
                          <img
                            src={getModelFavicon(modelFilter)}
                            alt={modelFilter}
                            className="w-6 h-6 rounded"
                          />
                        ) : (
                          <Bot className="w-6 h-6 text-gray-500" />
                        )}
                        <div className="max-w-[70%] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-2xl shadow-sm">
                          <div
                            className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: formatMarkdown(openPrompt.responses?.[modelFilter] ?? "") }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}