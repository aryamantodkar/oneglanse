import "server-only";

import { getDomain } from "@/app/(auth)/prompts/_lib/url/getDomain";
import type { DomainStats, PromptResponse } from "@/server/db/types";

export function extractDomainStatsFromResponses(
    responses: PromptResponse[]
  ): {
    combined: DomainStats[];
    byModel: Record<string, DomainStats[]>;
  } {
    const combinedMap = new Map<
      string,
      { totalOccurrences: number; citationTextCount: number }
    >();
  
    const modelMap = new Map<
      string,
      Map<string, { totalOccurrences: number; citationTextCount: number }>
    >();
  
    const addDomain = (
      map: Map<string, { totalOccurrences: number; citationTextCount: number }>,
      url: string,
      hasCitationText = false
    ) => {
      const domain = getDomain(url);
      if (!domain) return;
  
      const entry = map.get(domain) ?? {
        totalOccurrences: 0,
        citationTextCount: 0,
      };
  
      entry.totalOccurrences += 1;
      if (hasCitationText) entry.citationTextCount += 1;
  
      map.set(domain, entry);
    };
  
    for (const r of responses) {
      const model = r.model_provider;
  
      if (!modelMap.has(model)) {
        modelMap.set(model, new Map());
      }
  
      const perModelMap = modelMap.get(model)!;
  
      for (const c of r.citations ?? []) {
        if (c?.url) {
          addDomain(combinedMap, c.url, Boolean(c.cited_text));
          addDomain(perModelMap, c.url, Boolean(c.cited_text));
        }
      }
  
      for (const s of r.sources ?? []) {
        if (s?.url) {
          addDomain(combinedMap, s.url);
          addDomain(perModelMap, s.url);
        }
      }
    }
  
    const normalize = (
      map: Map<string, { totalOccurrences: number; citationTextCount: number }>
    ): DomainStats[] => {
      const total = Array.from(map.values()).reduce(
        (sum, d) => sum + d.totalOccurrences,
        0
      );
  
      return Array.from(map.entries()).map(([domain, stats]) => ({
        domain,
        totalOccurrences: stats.totalOccurrences,
        citationTextCount: stats.citationTextCount,
        usedPercentageAcrossAllDomains:
          total > 0
            ? Number(((stats.totalOccurrences / total) * 100).toFixed(1))
            : 0,
        avgCitationsPerDomain:
          stats.totalOccurrences > 0
            ? Number(
                (stats.citationTextCount / stats.totalOccurrences).toFixed(2)
              )
            : 0,
      }));
    };
  
    // 2️⃣ Build outputs
    const combined = normalize(combinedMap);
  
    const byModel: Record<string, DomainStats[]> = {};
    for (const [model, map] of modelMap.entries()) {
      byModel[model] = normalize(map);
    }
  
    return {
      combined,
      byModel,
    };
  }