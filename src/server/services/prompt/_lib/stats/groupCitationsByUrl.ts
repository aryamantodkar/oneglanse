import type { Citation, GroupedCitation } from "@/server/db/types";

export function groupCitationsByUrl(
    citations: (Citation & { model_provider?: string })[]
  ): GroupedCitation[] {
    const map = new Map<string, GroupedCitation>();
  
    const seen = new Set<string>();
  
    for (const c of citations) {
      if (!c?.url) continue;
  
      const uniqueKey = c.cited_text?.trim()
        ? `${c.title}::${c.model_provider}::${c.cited_text}`
        : `${c.title}::${c.model_provider}::${c.url}`;
  
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
  
      let entry = map.get(c.url);
  
      if (!entry) {
        entry = {
          url: c.url,
          title: c.title,
          citations: [],
          totalCitations: 0,
        };
        map.set(c.url, entry);
      }
  
      entry.citations.push({
        cited_text: c.cited_text,
        start_index: c.start_index ?? null,
        end_index: c.end_index ?? null,
        model_provider: c.model_provider,
      });
  
      entry.totalCitations += 1;
    }
  
    return Array.from(map.values());
  }