import type { DomainStats, PromptResponse } from "@oneglanse/types";
import { getDomain } from "../url/getDomain.js";

type DomainAccumulator = { totalOccurrences: number; sourceTextCount: number };

export function extractDomainStats(responses: PromptResponse[]): {
	combined: DomainStats[];
	byModel: Record<string, DomainStats[]>;
} {
	const combinedMap = new Map<string, DomainAccumulator>();
	const modelMap = new Map<string, Map<string, DomainAccumulator>>();

	const addDomain = (
		map: Map<string, DomainAccumulator>,
		url: string,
		hasSourceText: boolean,
	) => {
		const domain = getDomain(url);
		if (!domain) return;

		const entry = map.get(domain) ?? {
			totalOccurrences: 0,
			sourceTextCount: 0,
		};
		entry.totalOccurrences += 1;
		if (hasSourceText) entry.sourceTextCount += 1;
		map.set(domain, entry);
	};

	for (const r of responses) {
		const model = r.model_provider;

		if (!modelMap.has(model)) {
			modelMap.set(model, new Map());
		}
		const perModelMap = modelMap.get(model)!;

		for (const s of r.sources ?? []) {
			if (s?.url) {
				const hasText =
					typeof s.cited_text === "string"
						? s.cited_text.trim().length > 0
						: Boolean(s.cited_text);
				addDomain(combinedMap, s.url, hasText);
				addDomain(perModelMap, s.url, hasText);
			}
		}
	}

	const normalize = (map: Map<string, DomainAccumulator>): DomainStats[] => {
		const total = Array.from(map.values()).reduce(
			(sum, d) => sum + d.totalOccurrences,
			0,
		);

		return Array.from(map.entries()).map(([domain, stats]) => ({
			domain,
			totalOccurrences: stats.totalOccurrences,
			sourceTextCount: stats.sourceTextCount,
			usedPercentageAcrossAllDomains:
				total > 0
					? Number(((stats.totalOccurrences / total) * 100).toFixed(1))
					: 0,
			avgSourcesPerDomain:
				stats.totalOccurrences > 0
					? Number((stats.sourceTextCount / stats.totalOccurrences).toFixed(2))
					: 0,
		}));
	};

	const combined = normalize(combinedMap);

	const byModel: Record<string, DomainStats[]> = {};
	for (const [model, map] of modelMap.entries()) {
		byModel[model] = normalize(map);
	}

	return { combined, byModel };
}
