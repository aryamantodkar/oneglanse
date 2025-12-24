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
import type { UserPrompt } from "@/server/db/types";
import { Pencil } from "lucide-react";

export default function PromptsDataTable() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [initialPrompts, setInitialPrompts] = useState<UserPrompt[]>([]);
  const [modelFilter, setModelFilter] = useState("All Models");
  const [brandFilter, setBrandFilter] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<UserPrompt[]>([]);
  const [openPrompt, setOpenPrompt] = useState<null | typeof promptData[0]>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editPromptValue, setEditPromptValue] = useState("");

  const { data: userPrompts, isLoading, error } = fetchUserPrompts(workspaceId);
  const storePromptMutation = useStorePrompt();
  // const analyzeMetricsMutation = useAnalyzeMetrics();

  useEffect(() => {
    if (userPrompts?.data?.length) {
      setPromptData(userPrompts.data);
      setInitialPrompts(userPrompts.data);
    }
  }, [userPrompts]);
  

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
                let metrics = {
                  mentions: "-",
                  sentiment: "-",
                  visibility: "-",
                  position: "-",
                };

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
                    {/* <SelectContent className="z-[9999]">
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
                    </SelectContent> */}
                  </Select>
                </div>
              </DialogHeader>

              <DialogDescription className="sr-only">
                This dialog shows AI model responses for the selected prompt.
              </DialogDescription>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
