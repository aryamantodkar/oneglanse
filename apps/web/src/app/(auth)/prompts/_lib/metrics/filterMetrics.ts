import type { BrandMetric, FilterMetricsParams, GroupedMetrics, Metric } from "@/server/db/types";
import { isWithinRange } from "../date/dateFilter";

export function filterMetrics(
    metrics: GroupedMetrics,
    { modelFilter, timeFilter, brandFilter }: FilterMetricsParams
  ) {
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
  
        const filteredModels: Metric[] = [];

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

    return result;
  }