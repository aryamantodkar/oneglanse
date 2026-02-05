import type { FilterMetricsParams, PromptResponse } from "@onescope/types";
import { isWithinRange } from "../format/dateFilter.js";

export function filterPromptResponses(
    promptResponses: PromptResponse[],
    { modelFilter, timeFilter }: Pick<FilterMetricsParams, "modelFilter" | "timeFilter">
  ): PromptResponse[] {
    return promptResponses.filter((r) => {
      if (modelFilter !== "All Models" && r.model_provider !== modelFilter) {
        return false;
      }

      if (timeFilter !== "all") {
        const days =
          timeFilter === "7d" ? 7 :
          timeFilter === "14d" ? 14 :
          30;

        if (!isWithinRange(r.prompt_run_at, days)) return false;
      }

      return true;
    });
  }
