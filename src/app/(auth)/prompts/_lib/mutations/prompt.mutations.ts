import { api } from "@/trpc/react";

export function useStorePrompt() {
    return api.prompt.store.useMutation();
}

export function useAnalyzeMetrics() {
    return api.analysis.analyzeMetrics.useMutation();
}