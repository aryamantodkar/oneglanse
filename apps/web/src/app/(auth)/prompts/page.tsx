"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { ChevronDown, FilterX, Plus, Trash2, Bot, Pencil } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@onescope/ui";
import type { AnalysisRecord, BrandFilter, PromptResponse, UserPrompt } from "@onescope/types";
import { getDomain, getUniqueLinks, formatDate, formatMarkdown, getFaviconUrls, getModelFavicon, filterAnalysisRecords, modelSelectors } from "@onescope/utils";
import { PositionMetricCell, SentimentMetricCell } from "@onescope/ui";
import { useAnalyzeMetrics, useRunAgents, useStorePrompt } from "./_lib/mutations/prompt.mutations";
import { useAgentStatus, useFetchAnalysedPrompts, useUserPrompts } from "./_lib/queries/prompt.queries";
import type { Source } from "@onescope/types";

export default function Prompts() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [initialPrompts, setInitialPrompts] = useState<UserPrompt[]>([]);
  const [modelFilter, setModelFilter] = useState("All Models");
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
  const [analysisRecords, setAnalysisRecords] = useState<AnalysisRecord[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasCheckedForUnanalysed = useRef(false);

  const {
    data: userPrompts,
    isLoading: isUserPromptsLoading,
  } = useUserPrompts(workspaceId);

  const {
    data: analysedPromptData,
    isLoading: isAnalysedPromptsLoading,
    refetch: refetchAnalysedPrompts,
  } = useFetchAnalysedPrompts(workspaceId);

  const {
    data: agentResponse,
  } = useAgentStatus(workspaceId, jobId ?? "");
  
  const storePromptMutation = useStorePrompt();
  const analyzeMetricsMutation = useAnalyzeMetrics();
  const runAgentMutation = useRunAgents();

  useEffect(() => {
    if (userPrompts?.data?.length) {
      setPromptData(userPrompts.data);
      setInitialPrompts(userPrompts.data);
    }
  }, [userPrompts]);

  useEffect(() => {
    if(
      !analysedPromptData?.data ||
      !analysedPromptData.data.records ||
      !analysedPromptData.data.metadata
    ) return;

    setAnalysisRecords(analysedPromptData.data.records);
    setAvailableBrandFilters(analysedPromptData.data.metadata.available_brands);

    const randomBrand = analysedPromptData.data.metadata.available_brands[
      Math.floor(Math.random() * analysedPromptData.data.metadata.available_brands.length)
    ] ?? null;
    setBrandFilter(randomBrand);
  }, [analysedPromptData]);

  const filteredRecords = useMemo(() => {
    return filterAnalysisRecords(analysisRecords, {
      modelFilter,
      timeFilter,
      brandFilter,
    });
  }, [analysisRecords, modelFilter, timeFilter, brandFilter]);

  // Calculate metrics for each prompt based on model filter
  const promptsWithMetrics = useMemo(() => {
    return promptData.map(prompt => {
      const records = filteredRecords.filter(r => r.prompt_id === prompt.id);

      if (records.length === 0) {
        return { prompt, metrics: null, recordCount: 0, modelProvider: null };
      }

      // If a specific model is selected, use that model's metrics
      if (modelFilter !== "All Models") {
        const record = records.find(r => r.model_provider === modelFilter);
        if (!record || !record.is_analysed) {
          return { prompt, metrics: null, recordCount: records.length, modelProvider: modelFilter };
        }

        const brandMetrics = brandFilter
          ? record.brand_metrics[brandFilter.name]
          : Object.values(record.brand_metrics)[0];

        return {
          prompt,
          metrics: brandMetrics ?? null,
          recordCount: records.length,
          modelProvider: record.model_provider,
        };
      }

      // "All Models" selected - calculate average metrics across all analyzed records
      const analyzedRecords = records.filter(r => r.is_analysed);

      if (analyzedRecords.length === 0) {
        return { prompt, metrics: null, recordCount: records.length, modelProvider: "All Models" };
      }

      const allBrandMetrics = analyzedRecords
        .map(record => {
          return brandFilter
            ? record.brand_metrics[brandFilter.name]
            : Object.values(record.brand_metrics)[0];
        })
        .filter((m): m is NonNullable<typeof m> => !!m); // Remove undefined/null

      if (allBrandMetrics.length === 0) {
        return { prompt, metrics: null, recordCount: records.length, modelProvider: "All Models" };
      }

      // Calculate averages
      const avgMetrics = {
        mentions: Math.round(
          allBrandMetrics.reduce((sum, m) => sum + (m.mentions || 0), 0) / allBrandMetrics.length
        ),
        sentiment: parseFloat(
          (allBrandMetrics.reduce((sum, m) => sum + (m.sentiment || 0), 0) / allBrandMetrics.length).toFixed(1)
        ),
        visibility: Math.round(
          allBrandMetrics.reduce((sum, m) => sum + (m.visibility || 0), 0) / allBrandMetrics.length
        ),
        position: Math.round(
          allBrandMetrics.reduce((sum, m) => sum + (m.position || 0), 0) / allBrandMetrics.length
        ),
        website: allBrandMetrics[0]?.website,
      };

      return {
        prompt,
        metrics: avgMetrics,
        recordCount: records.length,
        modelProvider: "All Models",
      };
    });
  }, [promptData, filteredRecords, modelFilter, brandFilter]);

  const openPromptRecords = useMemo(() => {
    if (!openPrompt) return [];
    // Filter responses for this prompt using current filters
    return filteredRecords.filter(record => record.prompt_id === openPrompt.id);
  }, [openPrompt, filteredRecords]);

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

  const handleRunAgents = async () => {
    if (!workspaceId) return toast.error("Workspace ID is undefined.");

    setLoading(true);
    try {
      const jobDetails = await runAgentMutation.mutateAsync({ workspaceId });

      setJobId(jobDetails?.data?.jobId ?? null);
      toast.success("Agents started! Polling for results...");
    } catch (err) {
      console.error(err);
      toast.error("Failed to run prompts with agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceId || isAnalyzing || isAnalysedPromptsLoading) return;

    const agentJustCompleted = agentResponse?.status === "completed" && jobId;
    const needsInitialCheck = !hasCheckedForUnanalysed.current;

    if (!agentJustCompleted && !needsInitialCheck) return;

    if (needsInitialCheck) {
      hasCheckedForUnanalysed.current = true;
    }

    const runAnalysis = async () => {
      setIsAnalyzing(true);
      const toastId = toast.loading(
        agentJustCompleted
          ? "Analyzing agent responses..."
          : "Checking for unanalyzed responses..."
      );

      let totalAnalyzed = 0;
      let totalFailed = 0;
      let allErrors: Array<{ responseId: string; modelProvider: string; error: string }> = [];

      try {
        // Keep analyzing in batches until all responses are processed
        let hasMore = true;
        let batchNumber = 0;

        while (hasMore) {
          batchNumber++;
          const result = await analyzeMetricsMutation.mutateAsync({ workspaceId });
          const analysedCount = result?.data?.analysedCount ?? 0;
          const failedCount = result?.data?.failedCount ?? 0;
          const remainingCount = result?.data?.remainingCount ?? 0;
          const errors = result?.data?.errors ?? [];

          totalAnalyzed += analysedCount;
          totalFailed += failedCount;
          allErrors = allErrors.concat(errors);

          // Update progress toast
          if (remainingCount > 0) {
            toast.loading(
              `Analyzed ${totalAnalyzed} response${totalAnalyzed !== 1 ? "s" : ""}... ${remainingCount} remaining`,
              { id: toastId }
            );
          }

          hasMore = remainingCount > 0;
        }

        // Show final result
        if (totalAnalyzed > 0) {
          if (totalFailed > 0) {
            // Partial success
            toast.warning(
              `Analyzed ${totalAnalyzed} response${totalAnalyzed > 1 ? "s" : ""}, ${totalFailed} failed`,
              { id: toastId, duration: 5000 }
            );
            // Log errors to console for debugging
            console.error("Analysis errors:", allErrors);
          } else {
            // Full success
            toast.success(
              `Analyzed ${totalAnalyzed} response${totalAnalyzed > 1 ? "s" : ""}`,
              { id: toastId }
            );
          }
          await refetchAnalysedPrompts();
        } else if (totalFailed > 0) {
          // All failed
          toast.error(
            `Analysis failed for ${totalFailed} response${totalFailed > 1 ? "s" : ""}. Check console for details.`,
            { id: toastId, duration: 6000 }
          );
          console.error("Analysis errors:", allErrors);
        } else {
          // Nothing to analyze
          if (agentJustCompleted) {
            toast.success("Agent job completed!", { id: toastId });
          } else {
            toast.dismiss(toastId);
          }
        }

        if (agentJustCompleted) {
          setJobId(null);
        }
      } catch (err) {
        console.error("Analysis failed:", err);
        toast.error("Analysis failed", { id: toastId });
      } finally {
        setIsAnalyzing(false);
      }
    };

    runAnalysis();
  }, [
    workspaceId,
    agentResponse?.status,
    jobId,
    isAnalyzing,
    isAnalysedPromptsLoading,
    analyzeMetricsMutation,
    refetchAnalysedPrompts
  ]);

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
            {modelSelectors.map(({value, label}) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  {value === "All Models" ? (
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <img
                      src={getModelFavicon(value)}
                      alt={value}
                      className="w-4 h-4 rounded-sm"
                    />
                  )}
                  <span>{label}</span>
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
        <Button
          onClick={handleRunAgents}
        >
          Run Prompts
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
                  <TableHead className="text-sm font-medium text-gray-500 dark:text-gray-400 px-6 py-4 text-left">
                    Model
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
                {promptsWithMetrics.map(({ prompt, metrics, modelProvider }, promptIdx) => (
                  <TableRow
                    key={prompt.id}
                    onClick={() => setOpenPrompt(prompt)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors border-b border-gray-100/50 dark:border-gray-800/40 last:border-none"
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedRows.has(promptIdx)}
                        onCheckedChange={() => toggleRow(promptIdx)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>

                    <TableCell className="px-6 py-5 text-sm text-gray-800 dark:text-gray-200 leading-relaxed max-w-2xl">
                      {prompt.prompt}
                    </TableCell>

                    {!metrics ? (
                      <TableCell className="px-6 py-5 text-sm text-gray-400 dark:text-gray-500 text-center" colSpan={5}>
                        <span className="italic">No analysis data yet</span>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            {modelProvider === "All Models" ? (
                              <Bot className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <img
                                src={getModelFavicon(modelProvider)}
                                alt={modelProvider}
                                className="w-4 h-4 rounded-sm"
                              />
                            )}
                            <span>
                              {modelProvider === "All Models"
                                ? "Average"
                                : modelSelectors.find((m) => m.value === modelProvider)?.label || modelProvider
                              }
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 text-xs font-medium">
                            {metrics.mentions}
                          </span>
                        </TableCell>

                        <TableCell className="px-6 py-5 text-center">
                          <SentimentMetricCell sentiment={metrics.sentiment} />
                        </TableCell>

                        <TableCell className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300 text-center">
                          <span className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full px-2 py-1 text-xs font-medium">
                            {metrics.visibility}%
                          </span>
                        </TableCell>

                        <TableCell className="px-6 py-5 text-center">
                          <PositionMetricCell position={metrics.position} />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
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
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {openPrompt?.prompt}
                    </h2>

                    <span className="text-[11px] text-gray-400">
                      {openPromptRecords.length} total response{openPromptRecords.length !== 1 ? "s" : ""}
                    </span>
                  </div>
  
                    <Select value={modelFilter} onValueChange={setModelFilter}>
                      <SelectTrigger className="w-44 h-9 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 shrink-0">
                        <SelectValue placeholder="Select Model" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {modelSelectors.map(({value, label}) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {value === "All Models" ? (
                                <Bot className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <img
                                  src={getModelFavicon(value)}
                                  alt={value}
                                  className="w-4 h-4 rounded-sm"
                                />
                              )}
                              <span>{label}</span>
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
                    openPromptRecords.length > 0
                    ?
                    openPromptRecords.map((record: AnalysisRecord, index: number) => {
                      const isExpanded = expandedResponses.has(index);

                      return (
                        <div
                          key={record.id}
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
                                src={getModelFavicon(record.model_provider)}
                                alt={record.model_provider}
                                className="w-7 h-7 rounded-md"
                              />

                              <div className="flex flex-col">
                                <span className="text-md font-semibold text-gray-900 dark:text-gray-100">
                                {modelSelectors.find(m => m.value === record.model_provider)?.label || record.model_provider}
                                </span>

                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {formatDate(record.prompt_run_at)}
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
                              prose prose-sm dark:prose-invert max-w-none
                              prose-p:my-4 prose-headings:mt-6 prose-headings:mb-3
                              prose-ul:my-4 prose-ol:my-4 prose-li:my-1
                              prose-hr:my-6
                              transition-all duration-200 ease-in-out
                              ${isExpanded ? "" : "line-clamp-3 overflow-hidden"}
                            `}
                            dangerouslySetInnerHTML={{ __html: formatMarkdown(record.response) }}
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
                            {isExpanded ? "Show less" : "View full response"}
                          </button>

                          <SourcesCard
                            key={record.id}
                            sources={record.sources}
                          />
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

function SourcesCard({
  sources,
}: {
  sources: Source[];
}) {
  const MAX_VISIBLE = 5;
  const [showAllLinks, setShowAllLinks] = useState(false);

  const linksToShow = useMemo(() => {
    return getUniqueLinks(sources);
  }, [sources]);

  const visibleLinks = showAllLinks
    ? linksToShow
    : linksToShow.slice(0, MAX_VISIBLE);

  const remainingCount = linksToShow.length - MAX_VISIBLE;

  if (linksToShow.length === 0) return null;

  return (
    <div
      className="mt-3 flex flex-wrap gap-2 group"
      onClick={(e) => e.stopPropagation()}
    >
      {visibleLinks.map((item, i) => {
        const faviconUrls = getFaviconUrls(item.url, "");
        const domain = getDomain(item.url);

        return (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={item.title}
            className="
              relative
              inline-flex items-start gap-2

              h-[36px]
              group-hover:h-[52px]

              overflow-hidden

              rounded-md
              border border-gray-200/60 dark:border-gray-800/60
              bg-gray-50/50 dark:bg-gray-900/50

              px-2.5 py-2
              text-[11px]
              text-gray-600 dark:text-gray-400

              transition-all
              duration-200
              ease-out
            "
          >
            {/* Icon column */}
            {faviconUrls[0] && (
              <img
                src={faviconUrls[0]}
                alt=""
                className="
                  mt-0.5
                  h-3.5 w-3.5
                  rounded-sm
                  opacity-75
                  group-hover:opacity-100
                  transition-opacity
                  flex-shrink-0
                "
              />
            )}

            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="line-clamp-2 leading-snug">
                {item.title}
              </span>

              {domain && (
                <span
                  className="
                    text-[10px]
                    text-gray-400
                    truncate

                    opacity-0
                    translate-y-1

                    group-hover:opacity-100
                    group-hover:translate-y-0

                    transition-all
                    duration-200
                    delay-75
                    ease-out
                  "
                >
                  {domain}
                </span>
              )}
            </div>
          </a>
        );
      })}

      {!showAllLinks && remainingCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAllLinks(true);
          }}
          className="
            inline-flex items-center
            rounded-md
            border border-dashed border-gray-300/70 dark:border-gray-700/70
            px-2.5 py-1.5
            text-[11px]
            text-gray-500 dark:text-gray-400
            hover:text-gray-700 dark:hover:text-gray-200
            hover:border-gray-400 dark:hover:border-gray-600
            transition
          "
        >
          +{remainingCount} more
        </button>
      )}
    </div>
  );
}