import type { PromptResponse, CitationGroupResult, Citation } from "@/server/db/types";
import { groupCitationsByUrl } from "./groupCitationsByUrl";

export function extractCitationStatsFromResponses(
    responses: PromptResponse[]
  ): CitationGroupResult {
    const combinedCitations: (Citation & { model_provider: string })[] = [];
    const citationsByModel = new Map<
      string,
      (Citation & { model_provider: string })[]
    >();
  
    for (const resp of responses) {
      if (!Array.isArray(resp.citations)) continue;
  
      const model = resp.model_provider;
  
      for (const c of resp.citations) {
        if (
          !c ||
          typeof c.url !== "string" ||
          typeof c.title !== "string" ||
          typeof c.cited_text !== "string"
        ) {
          continue;
        }
  
        const citation = {
          title: c.title,
          url: c.url,
          start_index:
            typeof c.start_index === "number" ? c.start_index : null,
          end_index:
            typeof c.end_index === "number" ? c.end_index : null,
          cited_text: c.cited_text,
          model_provider: model,
        };
  
        // combined
        combinedCitations.push(citation);
  
        // per-model
        if (!citationsByModel.has(model)) {
          citationsByModel.set(model, []);
        }
        citationsByModel.get(model)!.push(citation);
      }
    }
  
    return {
      combined: groupCitationsByUrl(combinedCitations),
      byModel: Object.fromEntries(
        Array.from(citationsByModel.entries()).map(
          ([model, citations]) => [
            model,
            groupCitationsByUrl(citations),
          ]
        )
      ),
    };
  }