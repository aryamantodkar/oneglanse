import type { GroupedSource, Source } from "@oneglanse/types";

export function buildSourceOccurrenceKey(
	source: Pick<Source, "url" | "cited_text"> & { modelProvider?: string },
): string {
	const cleanCitedText = source.cited_text?.trim();
	return cleanCitedText
		? `${source.url}::${source.modelProvider ?? ""}::${cleanCitedText}`
		: `${source.url}::${source.modelProvider ?? ""}`;
}

export function groupSourcesByUrl(
	sources: (Source & { modelProvider?: string })[],
): GroupedSource[] {
	const map = new Map<string, GroupedSource>();
	const seen = new Set<string>();

	for (const s of sources) {
		if (!s?.url) continue;

		const key = buildSourceOccurrenceKey(s);

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
			cited_text: s.cited_text ?? "",
			model_provider: s.modelProvider,
		});

		entry.totalSources += 1;
	}

	return Array.from(map.values());
}
