import type { BrandMetric, GroupedMetrics } from "@/server/db/types";

export function aggregatePromptMetrics(filteredMetrics: GroupedMetrics){
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
          position: Number((positionSum / count).toFixed(1)),
          website,
        };
      }
    }
  
    return result;
}