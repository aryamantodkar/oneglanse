"use client";

import { useEffect, useState, useMemo, type JSX, useCallback } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, FilterX, Plus, Trash2 } from "lucide-react";
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
import { formatDate, formatMarkdown, getFaviconUrls, getModelFavicon, isWithinRange } from "@/lib/helper/functions";
import { PositionCell, SentimentCell } from "@/lib/helper/ui";
import { fetchUserPrompts, useStorePrompt, useAnalyzeMetrics, useFetchAnalysedPrompts } from "@/lib/helper/mutations";
import type { AnalysisModelResponseWithMetrics, BrandMetric, MetricPromptResponses, UserPrompt } from "@/server/db/types";
import { Pencil } from "lucide-react";

type BrandFilter = {
  name: string;
  website: string;
};

export default function Prompts() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [initialPrompts, setInitialPrompts] = useState<UserPrompt[]>([]);

  const [modelFilter, setModelFilter] = useState("All Models");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [brandFilter, setBrandFilter] = useState<BrandFilter | null>(null);
  const [availableBrandFilters, setAvailableBrandFilters] = useState<BrandFilter[]>([]);

  const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">("all");

  const [currentPrompt, setCurrentPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<UserPrompt[]>([]);
  const [openPrompt, setOpenPrompt] = useState<null | typeof promptData[0]>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editPromptValue, setEditPromptValue] = useState("");
  const [expandedResponses, setExpandedResponses] = useState<Set<number>>(new Set());

  const [openPromptResponses, setOpenPromptResponses] = useState<MetricPromptResponses[]>([]);

  const [originalMetricData, setOriginalMetricData] = useState<
    Record<string, Record<string, AnalysisModelResponseWithMetrics[]>>
  >({});

  const [metrics, setMetrics] = useState<
    Record<string, Record<string, AnalysisModelResponseWithMetrics[]>>
  >({});

  const {
    data: userPrompts,
    isLoading: isUserPromptsLoading,
    error: userPromptsError,
  } = fetchUserPrompts(workspaceId);
  
  const {
    data: analysedPromptData,
    isLoading: isAnalysedPromptsLoading,
    error: analysedPromptsError,
  } = useFetchAnalysedPrompts(workspaceId);
  
  const storePromptMutation = useStorePrompt();
  // const analyzeMetricsMutation = useAnalyzeMetrics();

  useEffect(() => {
    if (userPrompts?.data?.length) {
      setPromptData(userPrompts.data);
      setInitialPrompts(userPrompts.data);
    }
  }, [userPrompts]);

  useEffect(() => {
    const models = new Set<string>();
    const brands = new Map<string, string>();

    if (analysedPromptData?.data && typeof analysedPromptData.data === "object") {
      for (const [promptId, runs] of Object.entries(analysedPromptData.data)) {
        if (runs && typeof runs === "object") {
          if (typeof runs !== "object" || runs === null) continue;
          for (const [promptRunAt, modelProviders] of Object.entries(runs as Record<string, any>)) {
            if (!Array.isArray(modelProviders)) continue;
            for(const model of modelProviders){
              if (!model?.model_provider) continue;
              models.add(model.model_provider);

              if (model.brandMetrics && typeof model.brandMetrics === "object") {
                for (const [brandName, metrics] of Object.entries(model.brandMetrics)) {
                  if (
                    metrics &&
                    typeof metrics === "object" &&
                    "website" in metrics &&
                    typeof (metrics as { website?: unknown }).website === "string"
                  ) {
                    brands.set(brandName, (metrics as { website: string }).website);
                  }
                }
              }
            }
          }
        }
      }

      setOriginalMetricData(analysedPromptData.data);
      setMetrics(analysedPromptData?.data);
    }

    const brandArray = Array.from(brands, ([name, website]) => ({
      name,
      website,
    }));

    setAvailableModels(["All Models", ...Array.from(models)]);
    setAvailableBrandFilters(brandArray);

    const randomBrand = brandArray[Math.floor(Math.random() * brandArray.length)] ?? null;
    setBrandFilter(randomBrand);
  }, [analysedPromptData]);

  const filteredMetrics = useMemo(() => {
    let result: typeof metrics = {};
  
    for (const [promptId, runs] of Object.entries(metrics)) {
      for (const [promptRunAt, models] of Object.entries(runs)) {
  
        if (timeFilter !== "all") {
          const days =
            timeFilter === "7d" ? 7 :
            timeFilter === "14d" ? 14 :
            30;
  
          if (!isWithinRange(promptRunAt, days)) continue;
        }
  
        const filteredModels: AnalysisModelResponseWithMetrics[] = [];

        for (const model of models) {
          if (
            modelFilter !== "All Models" &&
            model.model_provider !== modelFilter
          ) {
            continue;
          }
  
          let brandMetrics: Record<string, BrandMetric> | undefined = model.brandMetrics;

          if (brandFilter?.name && brandMetrics) {
            const selected = brandMetrics[brandFilter.name];

            if (!selected) {
              continue;
            }

            brandMetrics = {
              [brandFilter.name]: selected,
            };
          }
  
          filteredModels.push({
            ...model,
            brandMetrics,
          });
        }
  
        if (filteredModels.length > 0) {
          if (!result[promptId]) result[promptId] = {};
          result[promptId][promptRunAt] = filteredModels;
        }
      }
    }

    console.log("filtered",result);
    return result;
  }, [metrics, modelFilter, timeFilter, brandFilter]);

  useEffect(() => {
    if (!openPrompt) {
      setOpenPromptResponses([]);
      return;
    }
  
    const promptRuns = filteredMetrics?.[openPrompt.id];
    if (!promptRuns) {
      setOpenPromptResponses([]);
      return;
    }
  
    const collectedResponses: MetricPromptResponses[] = [];
  
    Object.entries(promptRuns).forEach(([promptRunAt, models]) => {
      models.forEach((model) => {
        collectedResponses.push({
          model_provider: model.model_provider,
          response: model.response,
          promptRunAt,
        });
      });
    });
  
    setOpenPromptResponses(collectedResponses);
  }, [openPrompt, filteredMetrics]);

  const aggregatedPromptMetrics = useMemo(() => {
    const result: Record<
      string,
      BrandMetric
    > = {};
  
    for (const [promptId, runs] of Object.entries(filteredMetrics)) {
      let count = 0;
  
      let mentionsSum = 0;
      let sentimentSum = 0;
      let visibilitySum = 0;
      let positionSum = 0;
      let website = "";
  
      for (const models of Object.values(runs)) {
        for (const model of models) {
          const brandMetrics = model.brandMetrics;
          if (!brandMetrics) continue;
  
          const metric = Object.values(brandMetrics)[0];
          if (!metric) continue;
  
          mentionsSum += metric.mentions;
          sentimentSum += metric.sentiment;
          visibilitySum += metric.visibility;
          positionSum += metric.position;
  
          website = metric.website;
          count++;
        }
      }
  
      if (count > 0) {
        result[promptId] = {
          mentions: mentionsSum, 
          sentiment: Math.round(sentimentSum / count),
          visibility: Math.round(visibilitySum / count),
          position: Math.round(positionSum / count),
          website,
        };
      }
    }
  
    return result;
  }, [filteredMetrics]);

  const isModified = useMemo(() => {
    if (promptData.length !== initialPrompts.length) return true;
    return promptData.some((p, i) => p !== initialPrompts[i]);
  }, [promptData, initialPrompts]);

  const handleAddOrEditPrompt = () => {
    if(editIndex !== null){
      setPromptData((prev) =>
        prev.map((p, i) =>
          i === editIndex ? { ...p, prompt: editPromptValue.trim() } : p
        )
      );
      setEditIndex(null);
      setEditPromptValue("");
      setDialogOpen(false);
    }
    else{
      if (!currentPrompt.trim()) return;
    
      setPromptData([
        ...promptData,
        {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          user_id: "",          
          workspace_id: workspaceId ?? "",   
          prompt: currentPrompt.trim(), 
        },
      ]);
      
      setCurrentPrompt("");
      setDialogOpen(false);
    }
  };

  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      newSet.has(idx) ? newSet.delete(idx) : newSet.add(idx);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!workspaceId) return toast.error("Workspace ID is undefined.");

    setLoading(true);
    try {
      const prompts = promptData.map(p => p.prompt);
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

  const toggleResponse = (index: number) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // useEffect(() => {
  //   const fetchAnalysis = async () => {
  //     try {
  //     const analysisRes = await analyzeMetricsMutation.mutateAsync({ 
  //         workspaceId: 'workspace_67db1cf7-1a07-4253-ae26-e325258854e7',
  //         userId: '0njwwM0EkmAhFu1gtoJZDtu1QMdaUe5O',
  //       });
  //       console.log("analysisRes", analysisRes);
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   };
  //   fetchAnalysis();
  // }, []);

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 animate-pulse">
        <Bot className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
  
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading your prompts…
      </p>
    </div>
  );

  if (isUserPromptsLoading || isAnalysedPromptsLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex justify-between items-center px-6 py-4">
          <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
  
        <LoadingState />
      </div>
    );
  }

  return(
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex gap-3 items-center">
          <Dialog open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
          
              if (!open) {
                setEditIndex(null);
                setEditPromptValue("");
                setCurrentPrompt("");
              }
            }}>
            <DialogTrigger asChild>
              {
                selectedRows.size == 0
                ?
                <Button variant="outline" className="p-2 rounded-xl">
                  <Plus size={18} />
                </Button>
                :
                null
              }
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editIndex !== null ? "Edit Prompt" : "Add New Prompt"}
                </DialogTitle>
              </DialogHeader>
              <Textarea
                placeholder="Type your prompt..."
                rows={4}
                value={editIndex !== null ? editPromptValue : currentPrompt}
                onChange={(e) =>
                  editIndex !== null
                    ? setEditPromptValue(e.target.value)
                    : setCurrentPrompt(e.target.value)
                }
                className="w-full mt-2"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddOrEditPrompt}>
                  {editIndex !== null ? "Update" : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {selectedRows.size > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="p-2 rounded-xl"
                disabled={selectedRows.size !== 1}
                onClick={() => {
                  const idx = Array.from(selectedRows)[0];

                  if (typeof idx === "number" && idx >= 0 && idx < promptData.length) {
                    setEditIndex(idx);
                    setEditPromptValue(promptData[idx]?.prompt ?? "");
                  } else {
                    setEditIndex(null);
                    setEditPromptValue("");
                  }

                  setDialogOpen(true);
                }}
                title="Edit prompt"
              >
                <Pencil size={18} />
              </Button>

              <Button
                variant="outline"
                className="p-2 rounded-xl text-red-600 hover:bg-red-50"
                onClick={() => {
                  setPromptData((prev) =>
                    prev.filter((_, i) => !selectedRows.has(i))
                  );
                  setSelectedRows(new Set());
                }}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          )}
        </div>

        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="w-44 h-9 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 shrink-0">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            {availableModels.map((m) => (
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

        <Select
          value={brandFilter?.name}
          onValueChange={(value) => {
            const selectedBrand = availableBrandFilters.find(
              (b) => b.name === value
            );
        
            setBrandFilter(selectedBrand ?? null);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            {availableBrandFilters.map((m,index) => {
              const faviconUrls = getFaviconUrls(m.website ?? "", m.name);
              return (
                <SelectItem key={index} value={m.name}>
                  <div className="flex items-center gap-2">
                    <img
                        src={faviconUrls[0]}
                        alt={m.name}
                        className="w-4 h-4 rounded-sm bg-gray-100 dark:bg-gray-800"
                        onError={(e) => {
                            const img = e.currentTarget;
                            const index = Number(img.dataset.i || 0) + 1;

                            if (faviconUrls[index]) {
                            img.dataset.i = String(index);
                            img.src = faviconUrls[index];
                            }
                        }}
                    />
                    <span>{m.name}</span>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Select
          value={timeFilter}
          onValueChange={(value) =>
            setTimeFilter(value as "all" | "7d" | "14d" | "30d")
          }
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="14d">Last 14 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={handleSave}
          disabled={loading || !isModified || editIndex!==null}
          className={`py-2 px-6 rounded-xl transition ${
            loading || !isModified
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>

      {
        promptData.length > 0
        ?
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
                  let metrics = aggregatedPromptMetrics[prompt.id] ?? {
                    mentions: "-",
                    sentiment: "-",
                    visibility: "-",
                    position: "-",
                  };

                  return (
                    <TableRow
                      key={prompt.id}
                      onClick={() => {
                        setOpenPrompt(prompt);
                      }}
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
              className="
                !max-w-[90vw] !w-[90vw]
                sm:!max-w-[80vw] sm:!w-[80vw]
                h-[90vh]
                rounded-2xl
                px-8 pb-8 sm:px-10 sm:pt-12 sm:pb-10
                flex flex-col
              "
            >
                <DialogHeader className="mb-4">
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
                        {availableModels.map((m) => (
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

                    <Select
                      value={brandFilter?.name}
                      onValueChange={(value) => {
                        const selectedBrand = availableBrandFilters.find(
                          (b) => b.name === value
                        );
                    
                        setBrandFilter(selectedBrand ?? null);
                      }}
                    >
                      <SelectTrigger className="w-40 h-9 text-sm">
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBrandFilters.map((m,index) => {
                          const faviconUrls = getFaviconUrls(m.website ?? "", m.name);
                          return (
                            <SelectItem key={index} value={m.name}>
                              <div className="flex items-center gap-2">
                                <img
                                    src={faviconUrls[0]}
                                    alt={m.name}
                                    className="w-4 h-4 rounded-sm bg-gray-100 dark:bg-gray-800"
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        const index = Number(img.dataset.i || 0) + 1;

                                        if (faviconUrls[index]) {
                                        img.dataset.i = String(index);
                                        img.src = faviconUrls[index];
                                        }
                                    }}
                                />
                                <span>{m.name}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    <Select
                      value={timeFilter}
                      onValueChange={(value) =>
                        setTimeFilter(value as "all" | "7d" | "14d" | "30d")
                      }
                    >
                      <SelectTrigger className="w-40 h-9 text-sm">
                        <SelectValue placeholder="Time range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="14d">Last 14 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DialogHeader>
  
                <DialogDescription className="sr-only">
                  This dialog shows AI model responses for the selected prompt.
                </DialogDescription>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  {
                    openPromptResponses.length > 0
                    ?
                    openPromptResponses.map((resp, index) => {
                      const isExpanded = expandedResponses.has(index);
                    
                      return (
                        <div
                          key={index}
                          onClick={() => toggleResponse(index)}
                          data-expanded={isExpanded}
                          className={`
                            group cursor-pointer
                            rounded-2xl
                            border border-gray-200 dark:border-gray-800
                            bg-white dark:bg-gray-950
                            px-6 py-5
                            transition-all duration-200 ease-out

                            shadow-sm
                            hover:shadow-md
                            dark:shadow-black/20

                            ${isExpanded ? "shadow-lg ring-1 ring-gray-200 dark:ring-gray-700" : ""}
                          `}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-4">
                              <img
                                src={getModelFavicon(resp.model_provider)}
                                alt={resp.model_provider}
                                className="w-7 h-7 rounded-md"
                              />
                    
                              <div className="flex flex-col">
                                <span className="text-md font-semibold text-gray-900 dark:text-gray-100">
                                  {resp.model_provider}
                                </span>
                    
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(resp.promptRunAt)}
                                </span>
                              </div>
                            </div>
                    
                            <ChevronDown
                              className={`
                                w-5 h-5
                                text-gray-400
                                transition-transform duration-200
                                ${isExpanded ? "rotate-180" : "rotate-0"}
                                group-hover:text-gray-600 dark:group-hover:text-gray-300
                              `}
                            />
                          </div>

                          <div
                            className={`
                              prose dark:prose-invert max-w-none
                              text-[14px] leading-[1.55]
                              transition-all duration-200 ease-in-out
                              ${isExpanded ? "" : "line-clamp-3 overflow-hidden"}
                            `}
                            dangerouslySetInnerHTML={{ __html: formatMarkdown(resp.response) }}
                          />
                    
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleResponse(index);
                            }}
                            className="
                              mt-3
                              text-xs font-medium
                              text-gray-500
                              hover:text-gray-800 dark:hover:text-gray-200
                              transition-colors
                              opacity-70 group-hover:opacity-100
                            "
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        </div>
                      );
                    })
                    :
                    <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
                      <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800">
                          <FilterX className="w-5 h-5 text-gray-400" />
                        </div>

                      <h3 className="text-md font-medium text-gray-900 dark:text-gray-100">
                        No responses match your filters
                      </h3>

                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                        Try adjusting the selected brand, model, or time range to see available responses.
                      </p>
                    </div>
                  }
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        :
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
          <button onClick={() => setDialogOpen(true)} className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <Plus className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
  
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            No prompts yet
          </h3>
  
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            You haven’t added any prompts yet. Start by adding your first prompt to
            analyze model responses and brand metrics.
          </p>
        </div>
      }
    </div>
  )
}
