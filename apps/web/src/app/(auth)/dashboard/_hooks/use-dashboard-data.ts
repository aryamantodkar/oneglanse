import type { AnalysisRecord, BrandAnalysisResult } from "@oneglanse/types";
import {
	filterAnalysisRecords,
	getDomain,
	removeUrlParams,
} from "@oneglanse/utils";
import { useMemo } from "react";
import type { CompetitorData, DashboardMetrics } from "../_utils/types";

export function useDashboardData(
	analysedPromptData: AnalysisRecord[],
	modelFilter: string,
	timeFilter: "all" | "7d" | "14d" | "30d",
	workspaceBrand?: { name?: string | null; domain?: string | null },
): DashboardMetrics {
	// ─── 1. Filter step ──────────────────────────────────────────────────────

	const filteredRecords = useMemo(() => {
		const records = Array.isArray(analysedPromptData) ? analysedPromptData : [];
		return filterAnalysisRecords(records, { modelFilter, timeFilter });
	}, [analysedPromptData, modelFilter, timeFilter]);

	// ─── 2. Analyzed-only subset ──────────────────────────────────────────────

	const analyzedRecords = useMemo(() => {
		return filteredRecords.filter(
			(r): r is AnalysisRecord & { brand_analysis: BrandAnalysisResult } =>
				!!r.is_analysed && !!r.brand_analysis,
		);
	}, [filteredRecords]);

	// ─── 3. Single-pass aggregation (replaces 9 separate memos) ──────────────

	const aggregatedMetrics = useMemo(() => {
		const fallbackBrandName = workspaceBrand?.name?.trim() || "Your Brand";
		const fallbackBrandDomain = workspaceBrand?.domain?.trim() || "";
		const emptyReturn = {
			brandName: fallbackBrandName,
			brandDomain: fallbackBrandDomain,
			avgRank: { position: null as number | null, total: null as number | null },
			avgSentiment: { score: 0, label: "neutral" as const },
			impactMetrics: {
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
			},
			aggregateStats: {
				presenceRate: 0,
				winRate: 0,
				recRate: 0,
				topCompetitor: "N/A",
			},
			brandPerception: {
				bestKnownFor: null as string | null,
				pricingPerception: "not_mentioned",
				coreClaims: [] as string[],
				differentiators: [] as string[],
			},
			competitorData: [] as CompetitorData[],
		};

		if (analyzedRecords.length === 0) return emptyReturn;

		const total = analyzedRecords.length;

		// brandName / brandDomain
		let brandName = fallbackBrandName;
		let brandDomain = fallbackBrandDomain;

		// avgRank accumulators
		let rankSum = 0;
		let rankCount = 0;
		let totalRankedSum = 0;
		let totalRankedCount = 0;

		// avgSentiment
		let sentimentSum = 0;

		// impactMetrics
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

		// aggregateStats
		let mentionedCount = 0;
		let isTopPickCount = 0;
		let isRecommendedCount = 0;
		const competitorFrequency = new Map<string, number>();

		// brandPerception
		const bestKnownForCounts = new Map<string, number>();
		const pricingCounts = new Map<string, number>();
		const claimCounts = new Map<string, number>();
		const diffCounts = new Map<string, number>();

		// competitorData
		const competitorMap = new Map<
			string,
			{
				name: string;
				domain: string;
				appearances: number;
				visibilitySum: number;
				visibilityCount: number;
				sentimentSum: number;
				rankSum: number;
				rankCount: number;
				recCount: number;
				winsOver: Map<string, number>;
				losesTo: Map<string, number>;
			}
		>();

		for (const record of analyzedRecords) {
			const analysis = record.brand_analysis;

			// brandName / brandDomain (first occurrence)
			if (brandName === fallbackBrandName && analysis.metadata?.brandName) {
				brandName = analysis.metadata.brandName;
			}
			if (!brandDomain && analysis.metadata?.brandDomain) {
				brandDomain = analysis.metadata.brandDomain;
			}

			// avgRank
			if (analysis.position.rankPosition !== null) {
				rankSum += analysis.position.rankPosition;
				rankCount++;
			}
			if (analysis.position.totalRanked !== null) {
				totalRankedSum += analysis.position.totalRanked;
				totalRankedCount++;
			}

			// avgSentiment
			sentimentSum += analysis.sentiment.score;

			// impactMetrics
			geoScoreSum += analysis.geoScore.overall;
			visibilitySum += analysis.presence.visibility;

			if (
				analysis.recommendation.type === "top_pick" ||
				analysis.recommendation.type === "strong_alternative"
			) {
				recommendedCount++;
			}
			if (analysis.recommendation.type === "top_pick") {
				topPickCount++;
			}
			if (analysis.presence.firstMentionPosition === "top") {
				earlyMentionCount++;
			}
			if (
				analysis.presence.prominence === "dominant" ||
				analysis.presence.prominence === "significant"
			) {
				dominantPresenceCount++;
			}
			if (!analysis.presence.mentioned) {
				absentCount++;
			}
			if (analysis.risks.hasRisks && analysis.risks.items.length > 0) {
				responsesWithRisks++;
				for (const risk of analysis.risks.items) {
					if (risk.severity === "critical") criticalRiskCount++;
					if (risk.severity === "warning") warningRiskCount++;
				}
			}

			// aggregateStats
			if (analysis.presence.mentioned) mentionedCount++;
			if (analysis.position.isTopPick) isTopPickCount++;
			if (
				analysis.recommendation.type === "top_pick" ||
				analysis.recommendation.type === "strong_alternative"
			) {
				isRecommendedCount++;
			}
			for (const c of analysis.competitors) {
				competitorFrequency.set(
					c.name,
					(competitorFrequency.get(c.name) ?? 0) + 1,
				);
			}

			// brandPerception
			const p = analysis.perception;
			if (p.bestKnownFor) {
				bestKnownForCounts.set(
					p.bestKnownFor,
					(bestKnownForCounts.get(p.bestKnownFor) ?? 0) + 1,
				);
			}
			pricingCounts.set(
				p.pricingPerception,
				(pricingCounts.get(p.pricingPerception) ?? 0) + 1,
			);
			for (const c of p.coreClaims)
				claimCounts.set(c, (claimCounts.get(c) ?? 0) + 1);
			for (const d of p.differentiators)
				diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1);

			// competitorData
			for (const c of analysis.competitors) {
				const existing = competitorMap.get(c.name) ?? {
					name: c.name,
					domain: c.domain ?? "",
					appearances: 0,
					visibilitySum: 0,
					visibilityCount: 0,
					sentimentSum: 0,
					rankSum: 0,
					rankCount: 0,
					recCount: 0,
					winsOver: new Map<string, number>(),
					losesTo: new Map<string, number>(),
				};
				existing.appearances++;
				existing.visibilitySum += c.visibility;
				existing.visibilityCount++;
				existing.sentimentSum += c.sentiment;
				if (c.rankPosition !== null) {
					existing.rankSum += c.rankPosition;
					existing.rankCount++;
				}
				if (c.isRecommended) existing.recCount++;
				for (const w of c.winsOver) {
					existing.winsOver.set(w, (existing.winsOver.get(w) ?? 0) + 1);
				}
				for (const l of c.losesTo) {
					existing.losesTo.set(l, (existing.losesTo.get(l) ?? 0) + 1);
				}
				competitorMap.set(c.name, existing);
			}
		}

		// ── Derived values ────────────────────────────────────────────────────

		const avgRankPosition =
			rankCount > 0 ? Math.round(rankSum / rankCount) : null;
		const avgRankTotal =
			totalRankedCount > 0
				? Math.round(totalRankedSum / totalRankedCount)
				: null;

		const avgSentimentScore = Math.round(sentimentSum / total);
		const avgSentimentLabel =
			avgSentimentScore >= 80
				? ("very_positive" as const)
				: avgSentimentScore >= 60
					? ("positive" as const)
					: avgSentimentScore >= 40
						? ("neutral" as const)
						: avgSentimentScore >= 20
							? ("negative" as const)
							: ("very_negative" as const);

		const topCompetitor =
			[...competitorFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
			"N/A";

		const competitorList = [...competitorMap.values()]
			.map((c) => ({
				name: c.name,
				domain: c.domain,
				appearances: c.appearances,
				visibility:
					c.visibilityCount > 0
						? Math.round(c.visibilitySum / c.visibilityCount)
						: 0,
				avgSentiment: Math.round(c.sentimentSum / c.appearances),
				avgRank:
					c.rankCount > 0 ? Math.round(c.rankSum / c.rankCount) : null,
				recCount: c.recCount,
				winsOver: [...c.winsOver.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
				losesTo: [...c.losesTo.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
			}))
			.sort((a, b) => b.appearances - a.appearances);

		const brandEntry: CompetitorData = {
			name: brandName,
			domain: brandDomain,
			appearances: mentionedCount,
			visibility: Math.round(visibilitySum / total),
			avgSentiment: avgSentimentScore,
			avgRank: avgRankPosition,
			recCount: 0,
			winsOver: [],
			losesTo: [],
			isBrand: true,
		};

		return {
			brandName,
			brandDomain,
			avgRank: { position: avgRankPosition, total: avgRankTotal },
			avgSentiment: { score: avgSentimentScore, label: avgSentimentLabel },
			impactMetrics: {
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
			},
			aggregateStats: {
				presenceRate: Math.round((mentionedCount / total) * 100),
				winRate: Math.round((isTopPickCount / total) * 100),
				recRate: Math.round((isRecommendedCount / total) * 100),
				topCompetitor,
			},
			brandPerception: {
				bestKnownFor:
					[...bestKnownForCounts.entries()].sort(
						(a, b) => b[1] - a[1],
					)[0]?.[0] ?? null,
				pricingPerception:
					[...pricingCounts.entries()].sort(
						(a, b) => b[1] - a[1],
					)[0]?.[0] ?? "not_mentioned",
				coreClaims: [...claimCounts.entries()]
					.sort((a, b) => b[1] - a[1])
					.slice(0, 8)
					.map(([t]) => t),
				differentiators: [...diffCounts.entries()]
					.sort((a, b) => b[1] - a[1])
					.slice(0, 8)
					.map(([t]) => t),
			},
			competitorData: [brandEntry, ...competitorList],
		};
	}, [analyzedRecords, workspaceBrand?.name, workspaceBrand?.domain]);

	// ─── 4. Sources intelligence (separate input: filteredRecords) ─────────────

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

	return {
		...aggregatedMetrics,
		sourcesIntelligence: sourcesIntelligence.sources,
		totalCitations: sourcesIntelligence.totalCitations,
		analyzedRecords,
	};
}
