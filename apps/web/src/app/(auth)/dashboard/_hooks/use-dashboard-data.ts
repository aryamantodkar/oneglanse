import type { AnalysisRecord, BrandAnalysisResult } from "@oneglanse/types";
import {
	filterAnalysisRecords,
	getDomain,
	removeUrlParams,
} from "@oneglanse/utils";
import { useMemo } from "react";
import { severityRank } from "../_utils/helpers";
import type { DashboardMetrics } from "../_utils/types";

export function useDashboardData(
	analysedPromptData: any,
	modelFilter: string,
	timeFilter: "all" | "7d" | "14d" | "30d",
): DashboardMetrics {
	// ─── Data Extraction ─────────────────────────────────────────────────────

	const allRecords = useMemo<AnalysisRecord[]>(() => {
		if (!analysedPromptData) return [];
		if (Array.isArray(analysedPromptData)) return analysedPromptData;
		return [];
	}, [analysedPromptData]);

	const filteredRecords = useMemo(() => {
		return filterAnalysisRecords(allRecords, { modelFilter, timeFilter });
	}, [allRecords, modelFilter, timeFilter]);

	const analyzedRecords = useMemo(() => {
		return filteredRecords.filter(
			(r): r is AnalysisRecord & { brand_analysis: BrandAnalysisResult } =>
				!!r.is_analysed && !!r.brand_analysis,
		);
	}, [filteredRecords]);

	// ─── Aggregations ────────────────────────────────────────────────────────

	const brandName = useMemo(() => {
		const first = analyzedRecords.find(
			(r) => r.brand_analysis.metadata?.brandName,
		);
		return first?.brand_analysis.metadata?.brandName ?? "Your Brand";
	}, [analyzedRecords]);

	const brandDomain = useMemo(() => {
		return (
			analyzedRecords.find((r) => r.brand_analysis.metadata?.brandDomain)
				?.brand_analysis.metadata?.brandDomain ?? ""
		);
	}, [analyzedRecords]);

	const avgRank = useMemo(() => {
		const withRank = analyzedRecords.filter(
			(r) => r.brand_analysis.position.rankPosition !== null,
		);
		if (withRank.length === 0) return { position: null, total: null };
		const avgPos = Math.round(
			withRank.reduce(
				(s, r) => s + r.brand_analysis.position.rankPosition!,
				0,
			) / withRank.length,
		);
		const withTotal = withRank.filter(
			(r) => r.brand_analysis.position.totalRanked !== null,
		);
		const avgTotal =
			withTotal.length > 0
				? Math.round(
						withTotal.reduce(
							(s, r) => s + r.brand_analysis.position.totalRanked!,
							0,
						) / withTotal.length,
					)
				: null;
		return { position: avgPos, total: avgTotal };
	}, [analyzedRecords]);

	const avgSentiment = useMemo(() => {
		if (analyzedRecords.length === 0)
			return { score: 0, label: "neutral" as const };
		const avg = Math.round(
			analyzedRecords.reduce(
				(s, r) => s + r.brand_analysis.sentiment.score,
				0,
			) / analyzedRecords.length,
		);
		const label =
			avg >= 80
				? "very_positive"
				: avg >= 60
					? "positive"
					: avg >= 40
						? "neutral"
						: avg >= 20
							? "negative"
							: "very_negative";
		return { score: avg, label };
	}, [analyzedRecords]);

	const impactMetrics = useMemo(() => {
		if (analyzedRecords.length === 0) {
			return {
				totalResponses: 0,
				avgGeoScore: 0,
				avgVisibility: 0,
				recommendationRate: 0,
				topPickRate: 0,
				earlyMentionRate: 0,
				dominantPresenceRate: 0,
				absentRate: 0,
				riskResponseRate: 0,
				criticalRiskCount: 0,
				warningRiskCount: 0,
			};
		}

		const total = analyzedRecords.length;
		let geoScoreSum = 0;
		let visibilitySum = 0;
		let recommendedCount = 0;
		let topPickCount = 0;
		let earlyMentionCount = 0;
		let dominantPresenceCount = 0;
		let absentCount = 0;
		let responsesWithRisks = 0;
		let criticalRiskCount = 0;
		let warningRiskCount = 0;

		for (const record of analyzedRecords) {
			const analysis = record.brand_analysis;
			geoScoreSum += analysis.geoScore.overall;
			visibilitySum += analysis.presence.visibility;

			if (
				analysis.recommendation.type === "top_pick" ||
				analysis.recommendation.type === "strong_alternative"
			) {
				recommendedCount += 1;
			}

			if (analysis.recommendation.type === "top_pick") {
				topPickCount += 1;
			}

			if (analysis.presence.firstMentionPosition === "top") {
				earlyMentionCount += 1;
			}

			if (
				analysis.presence.prominence === "dominant" ||
				analysis.presence.prominence === "significant"
			) {
				dominantPresenceCount += 1;
			}

			if (!analysis.presence.mentioned) {
				absentCount += 1;
			}

			if (analysis.risks.hasRisks && analysis.risks.items.length > 0) {
				responsesWithRisks += 1;
				for (const risk of analysis.risks.items) {
					if (risk.severity === "critical") criticalRiskCount += 1;
					if (risk.severity === "warning") warningRiskCount += 1;
				}
			}
		}

		return {
			totalResponses: total,
			avgGeoScore: Math.round(geoScoreSum / total),
			avgVisibility: Math.round(visibilitySum / total),
			recommendationRate: Math.round((recommendedCount / total) * 100),
			topPickRate: Math.round((topPickCount / total) * 100),
			earlyMentionRate: Math.round((earlyMentionCount / total) * 100),
			dominantPresenceRate: Math.round((dominantPresenceCount / total) * 100),
			absentRate: Math.round((absentCount / total) * 100),
			riskResponseRate: Math.round((responsesWithRisks / total) * 100),
			criticalRiskCount,
			warningRiskCount,
		};
	}, [analyzedRecords]);

	const aggregateStats = useMemo(() => {
		if (analyzedRecords.length === 0) {
			return { presenceRate: 0, winRate: 0, recRate: 0, topCompetitor: "N/A" };
		}
		const total = analyzedRecords.length;
		const mentioned = analyzedRecords.filter(
			(r) => r.brand_analysis.presence.mentioned,
		).length;
		const isTopPick = analyzedRecords.filter(
			(r) => r.brand_analysis.position.isTopPick,
		).length;
		const isRecommended = analyzedRecords.filter((r) =>
			["top_pick", "strong_alternative"].includes(
				r.brand_analysis.recommendation.type,
			),
		).length;

		const competitorCounts = new Map<string, number>();
		for (const r of analyzedRecords) {
			for (const c of r.brand_analysis.competitors) {
				competitorCounts.set(c.name, (competitorCounts.get(c.name) ?? 0) + 1);
			}
		}
		const topCompetitor =
			[...competitorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
			"N/A";

		return {
			presenceRate: Math.round((mentioned / total) * 100),
			winRate: Math.round((isTopPick / total) * 100),
			recRate: Math.round((isRecommended / total) * 100),
			topCompetitor,
		};
	}, [analyzedRecords]);

	const competitorData = useMemo(() => {
		if (analyzedRecords.length === 0) return [];

		const map = new Map<
			string,
			{
				name: string;
				domain: string;
				appearances: number;
				sentimentSum: number;
				rankSum: number;
				rankCount: number;
				recCount: number;
				winsOver: Map<string, number>;
				losesTo: Map<string, number>;
			}
		>();

		for (const r of analyzedRecords) {
			for (const c of r.brand_analysis.competitors) {
				const existing = map.get(c.name) ?? {
					name: c.name,
					domain: c.domain ?? "",
					appearances: 0,
					sentimentSum: 0,
					rankSum: 0,
					rankCount: 0,
					recCount: 0,
					winsOver: new Map<string, number>(),
					losesTo: new Map<string, number>(),
				};
				existing.appearances += 1;
				existing.sentimentSum += c.sentiment;
				if (c.rankPosition !== null) {
					existing.rankSum += c.rankPosition;
					existing.rankCount += 1;
				}
				if (c.isRecommended) existing.recCount += 1;
				for (const w of c.winsOver) {
					existing.winsOver.set(w, (existing.winsOver.get(w) ?? 0) + 1);
				}
				for (const l of c.losesTo) {
					existing.losesTo.set(l, (existing.losesTo.get(l) ?? 0) + 1);
				}
				map.set(c.name, existing);
			}
		}

		const competitorList = [...map.values()]
			.map((c) => ({
				name: c.name,
				domain: c.domain,
				appearances: c.appearances,
				avgSentiment: Math.round(c.sentimentSum / c.appearances),
				avgRank: c.rankCount > 0 ? Math.round(c.rankSum / c.rankCount) : null,
				recCount: c.recCount,
				winsOver: [...c.winsOver.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
				losesTo: [...c.losesTo.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
			}))
			.sort((a, b) => b.appearances - a.appearances);

		// Build brand entry and merge into competitor array
		const brandAppearances = analyzedRecords.filter(
			(r) => r.brand_analysis.presence.mentioned,
		).length;

		const brandEntry = {
			name: brandName,
			domain: brandDomain,
			appearances: brandAppearances,
			avgSentiment: avgSentiment.score,
			avgRank: avgRank.position,
			recCount: 0,
			winsOver: [] as string[],
			losesTo: [] as string[],
			isBrand: true,
		};

		return [brandEntry, ...competitorList];
	}, [
		analyzedRecords,
		brandName,
		brandDomain,
		avgSentiment.score,
		avgRank.position,
	]);

	const sentimentBreakdown = useMemo(() => {
		const positiveCounts = new Map<string, number>();
		const negativeCounts = new Map<string, number>();
		for (const r of analyzedRecords) {
			for (const p of r.brand_analysis.sentiment.positives)
				positiveCounts.set(p, (positiveCounts.get(p) ?? 0) + 1);
			for (const n of r.brand_analysis.sentiment.negatives)
				negativeCounts.set(n, (negativeCounts.get(n) ?? 0) + 1);
		}
		return {
			positives: [...positiveCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([text, count]) => ({ text, count })),
			negatives: [...negativeCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([text, count]) => ({ text, count })),
		};
	}, [analyzedRecords]);

	const brandPerception = useMemo(() => {
		const bestKnownForCounts = new Map<string, number>();
		const pricingCounts = new Map<string, number>();
		const claimCounts = new Map<string, number>();
		const diffCounts = new Map<string, number>();

		for (const r of analyzedRecords) {
			const p = r.brand_analysis.perception;
			if (p.bestKnownFor)
				bestKnownForCounts.set(
					p.bestKnownFor,
					(bestKnownForCounts.get(p.bestKnownFor) ?? 0) + 1,
				);
			pricingCounts.set(
				p.pricingPerception,
				(pricingCounts.get(p.pricingPerception) ?? 0) + 1,
			);
			for (const c of p.coreClaims)
				claimCounts.set(c, (claimCounts.get(c) ?? 0) + 1);
			for (const d of p.differentiators)
				diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1);
		}

		return {
			bestKnownFor:
				[...bestKnownForCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
				null,
			pricingPerception:
				[...pricingCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
				"not_mentioned",
			coreClaims: [...claimCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([t]) => t),
			differentiators: [...diffCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([t]) => t),
		};
	}, [analyzedRecords]);

	const sourcesIntelligence = useMemo(() => {
		const domainMap = new Map<
			string,
			{
				domain: string;
				favicon: string | null;
				citationCount: number;
				uniqueRecords: Set<string>;
				models: Set<string>;
				excerpts: { text: string; model: string }[];
				urls: Set<string>;
			}
		>();
		const seenCitations = new Set<string>();

		for (const r of filteredRecords) {
			for (const s of r.sources) {
				const cleanUrl = removeUrlParams(s.url);
				const domain = getDomain(cleanUrl);
				if (!domain) continue;

				const dedupeKey = s.cited_text?.trim()
					? `${s.title}::${r.model_provider}::${s.cited_text}`
					: `${s.title}::${r.model_provider}::${cleanUrl}`;
				if (seenCitations.has(dedupeKey)) continue;
				seenCitations.add(dedupeKey);

				const existing = domainMap.get(domain) ?? {
					domain,
					favicon: s.favicon ?? null,
					citationCount: 0,
					uniqueRecords: new Set<string>(),
					models: new Set<string>(),
					excerpts: [],
					urls: new Set<string>(),
				};
				existing.citationCount += 1;
				existing.uniqueRecords.add(r.id);
				existing.models.add(r.model_provider);
				existing.urls.add(cleanUrl);
				if (s.cited_text) {
					existing.excerpts.push({
						text: s.cited_text,
						model: r.model_provider,
					});
				}
				domainMap.set(domain, existing);
			}
		}

		const allDomains = [...domainMap.values()].sort(
			(a, b) => b.citationCount - a.citationCount,
		);
		const totalCitations = allDomains.reduce(
			(sum, d) => sum + d.citationCount,
			0,
		);
		return { sources: allDomains.slice(0, 15), totalCitations };
	}, [filteredRecords]);

	const aggregatedRisks = useMemo(() => {
		const riskMap = new Map<
			string,
			{ type: string; severity: string; detail: string; count: number }
		>();
		for (const r of analyzedRecords) {
			if (!r.brand_analysis.risks.hasRisks) continue;
			for (const risk of r.brand_analysis.risks.items) {
				const key = risk.detail.toLowerCase().trim();
				const existing = riskMap.get(key);
				if (
					!existing ||
					severityRank(risk.severity) > severityRank(existing.severity)
				) {
					riskMap.set(key, { ...risk, count: (existing?.count ?? 0) + 1 });
				} else if (existing) {
					existing.count += 1;
				}
			}
		}
		return [...riskMap.values()].sort((a, b) => {
			const sevDiff = severityRank(b.severity) - severityRank(a.severity);
			return sevDiff !== 0 ? sevDiff : b.count - a.count;
		});
	}, [analyzedRecords]);

	const groupedRecords = useMemo(() => {
		const groups = new Map<string, AnalysisRecord[]>();

		for (const record of analyzedRecords) {
			const prompt = record.prompt;
			if (!groups.has(prompt)) {
				groups.set(prompt, []);
			}
			groups.get(prompt)!.push(record);
		}

		return Array.from(groups.entries()).map(([prompt, records]) => {
			// Sort records within group by model provider
			const sortedGroupRecords = records.sort((a, b) =>
				a.model_provider.localeCompare(b.model_provider),
			);

			// Calculate aggregate metrics
			const avgScore = Math.round(
				sortedGroupRecords.reduce(
					(sum, r) => sum + r.brand_analysis!.geoScore.overall,
					0,
				) / sortedGroupRecords.length,
			);

			const avgSentiment = Math.round(
				sortedGroupRecords.reduce(
					(sum, r) => sum + r.brand_analysis!.sentiment.score,
					0,
				) / sortedGroupRecords.length,
			);

			const rankPositions = sortedGroupRecords
				.map((r) => r.brand_analysis!.position.rankPosition)
				.filter((r): r is number => r !== null);
			const bestRank =
				rankPositions.length > 0 ? Math.min(...rankPositions) : null;

			// Get best recommendation type (prioritize top_pick > strong_alternative > etc)
			const recTypeOrder = [
				"top_pick",
				"strong_alternative",
				"conditional",
				"mentioned_only",
				"discouraged",
				"not_mentioned",
			];
			const topRecType = sortedGroupRecords
				.map((r) => r.brand_analysis!.recommendation.type)
				.sort((a, b) => recTypeOrder.indexOf(a) - recTypeOrder.indexOf(b))[0]!;

			return {
				prompt,
				records: sortedGroupRecords,
				avgScore,
				avgSentiment,
				bestRank,
				topRecType,
			};
		});
	}, [analyzedRecords]);

	return {
		brandName,
		brandDomain,
		avgRank,
		avgSentiment,
		impactMetrics,
		aggregateStats,
		competitorData,
		sentimentBreakdown,
		brandPerception,
		sourcesIntelligence: sourcesIntelligence.sources,
		totalCitations: sourcesIntelligence.totalCitations,
		aggregatedRisks,
		groupedRecords,
		analyzedRecords,
	};
}
