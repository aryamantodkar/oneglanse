import type { GroupedSource, Source } from "@onescope/types";

export function groupSourcesByUrl(
  sources: (Source & { modelProvider?: string })[]
): GroupedSource[] {
  const map = new Map<string, GroupedSource>();
  const seen = new Set<string>();

  for (const s of sources) {
    if (!s?.url) continue;

    const key = s.citedText?.trim()
      ? `${s.title}::${s.modelProvider}::${s.citedText}`
      : `${s.title}::${s.modelProvider}::${s.url}`;

    if (seen.has(key)) continue;
    seen.add(key);

    let entry = map.get(s.url);

    if (!entry) {
      entry = {
        url: s.url,
        title: s.title,
        excerpts: [],
        totalSources: 0,
      };
      map.set(s.url, entry);
    }

    entry.excerpts.push({
      cited_text: s.citedText ?? "",
      model_provider: s.modelProvider,
    });

    entry.totalSources += 1;
  }

  return Array.from(map.values());
}
