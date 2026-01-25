import { api } from "@/trpc/react";

export function useAnalyzeCompetitors() {
    return api.competitors.analyseCompetitors.useMutation();
}