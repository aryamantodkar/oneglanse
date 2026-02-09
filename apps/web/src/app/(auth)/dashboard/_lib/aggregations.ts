import type { AnalysisRecord, LLMBrandAnalysis } from "@onescope/types";
import type {
  DomainSummary,
  BrandHealthScore,
  CompetitivePosition,
  SentimentInsights,
  CompetitiveThreat,
  StrategicOpportunities,
  RecentInsight
} from "./types";

// Helper: Calculate average of numbers
function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

// Extract full analysis data from records
export function extractFullAnalysisData(records: AnalysisRecord[]): LLMBrandAnalysis[] {
  return records
    .filter(r => r.full_analysis)
    .map(r => r.full_analysis!);
}

// Calculate Brand Health Score (0-100 composite)
export function calculateBrandHealthScore(analyses: LLMBrandAnalysis[]): BrandHealthScore {
  if (analyses.length === 0) {
    return {
      score: 0,
      visibility: 0,
      sentiment: 0,
      recommendation: 0,
      trend: 'stable'
    };
  }

  // Calculate visibility score (0-100)
  const visibilityScores = analyses.map(a => a.target_brand.visibility.visibility_score);
  const avgVisibility = Math.round(avg(visibilityScores));

  // Calculate sentiment score (0-100) from -1 to 1 scale
  const sentimentScores = analyses.map(a => {
    const score = a.target_brand.sentiment.score;
    return (score + 1) * 50; // Convert -1 to 1 scale to 0-100
  });
  const avgSentiment = Math.round(avg(sentimentScores));

  // Calculate recommendation score (0-100)
  const recommendationScores = analyses.map(a => {
    const strength = a.target_brand.visibility.recommendation_strength;
    const scoreMap: Record<string, number> = {
      'primary_choice': 100,
      'strong_option': 80,
      'among_options': 60,
      'mentioned_only': 40,
      'not_recommended': 20,
      'not_mentioned': 0
    };
    return scoreMap[strength] || 0;
  });
  const avgRecommendation = Math.round(avg(recommendationScores));

  // Weighted composite score
  const compositeScore = Math.round(
    avgVisibility * 0.4 +
    avgSentiment * 0.3 +
    avgRecommendation * 0.3
  );

  // Determine trend (compare first half vs second half)
  const halfPoint = Math.floor(analyses.length / 2);
  if (halfPoint > 0) {
    const firstHalfAvg = avg(analyses.slice(0, halfPoint).map(a => a.target_brand.visibility.visibility_score));
    const secondHalfAvg = avg(analyses.slice(halfPoint).map(a => a.target_brand.visibility.visibility_score));
    const diff = secondHalfAvg - firstHalfAvg;

    const trend = diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';

    return {
      score: compositeScore,
      visibility: avgVisibility,
      sentiment: avgSentiment,
      recommendation: avgRecommendation,
      trend
    };
  }

  return {
    score: compositeScore,
    visibility: avgVisibility,
    sentiment: avgSentiment,
    recommendation: avgRecommendation,
    trend: 'stable'
  };
}

// Get competitive positioning
export function getCompetitivePosition(analyses: LLMBrandAnalysis[]): CompetitivePosition {
  if (analyses.length === 0) {
    return {
      current: 'not_positioned',
      shareOfVoice: 0,
      rank: null,
      competitorCount: 0
    };
  }

  // Get most common positioning
  const positions = analyses.map(a => a.target_brand.competitive_intelligence.competitive_positioning);
  const positionCounts = positions.reduce((acc, pos) => {
    acc[pos] = (acc[pos] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostCommonPosition = Object.entries(positionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'not_positioned';

  // Average share of voice
  const shareOfVoices = analyses.map(a => a.target_brand.visibility.share_of_voice);
  const avgShareOfVoice = Math.round(avg(shareOfVoices) * 10) / 10;

  // Get most common rank
  const ranks = analyses.map(a => a.target_brand.visibility.rank).filter(r => r !== null) as number[];
  const avgRank = ranks.length > 0 ? Math.round(avg(ranks)) : null;

  // Get competitor count
  const competitorCounts = analyses.map(a => a.target_brand.competitive_intelligence.total_competitors_mentioned);
  const avgCompetitorCount = Math.round(avg(competitorCounts));

  return {
    current: mostCommonPosition,
    shareOfVoice: avgShareOfVoice,
    rank: avgRank,
    competitorCount: avgCompetitorCount
  };
}

// Extract sentiment signals
export function getSentimentInsights(analyses: LLMBrandAnalysis[]): SentimentInsights {
  if (analyses.length === 0) {
    return {
      positiveSignals: [],
      negativeSignals: [],
      topStrengths: [],
      topWeaknesses: []
    };
  }

  // Aggregate positive and negative signals
  const allPositiveSignals = analyses.flatMap(a => a.target_brand.sentiment.positive_signals);
  const allNegativeSignals = analyses.flatMap(a => a.target_brand.sentiment.negative_signals);

  // Count frequencies
  const positiveCounts = allPositiveSignals.reduce((acc, signal) => {
    acc[signal] = (acc[signal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const negativeCounts = allNegativeSignals.reduce((acc, signal) => {
    acc[signal] = (acc[signal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top 5 of each
  const topPositive = Object.entries(positiveCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  const topNegative = Object.entries(negativeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  // Aggregate strengths and weaknesses
  const allStrengths = analyses.flatMap(a => a.target_brand.brand_narrative.strengths_cited);
  const allWeaknesses = analyses.flatMap(a => a.target_brand.brand_narrative.weaknesses_cited);

  const strengthCounts = allStrengths.reduce((acc, strength) => {
    acc[strength] = (acc[strength] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const weaknessCounts = allWeaknesses.reduce((acc, weakness) => {
    acc[weakness] = (acc[weakness] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([strength]) => strength);

  const topWeaknesses = Object.entries(weaknessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([weakness]) => weakness);

  return {
    positiveSignals: topPositive,
    negativeSignals: topNegative,
    topStrengths,
    topWeaknesses
  };
}

// Identify competitive threats
export function getCompetitiveThreats(analyses: LLMBrandAnalysis[]): CompetitiveThreat[] {
  if (analyses.length === 0) {
    return [];
  }

  const competitorMap = new Map<string, {
    winCount: number;
    totalMentions: number;
    threats: Set<string>;
    lastSeen: string;
  }>();

  analyses.forEach(analysis => {
    const comparisons = analysis.target_brand.competitive_intelligence.direct_comparisons;

    comparisons.forEach(comparison => {
      const competitorName = comparison.competitor_name;

      if (!competitorMap.has(competitorName)) {
        competitorMap.set(competitorName, {
          winCount: 0,
          totalMentions: 0,
          threats: new Set(),
          lastSeen: analysis.target_brand.brand_presence.mention_contexts[0]?.character_position?.toString() || ''
        });
      }

      const competitor = competitorMap.get(competitorName)!;
      competitor.totalMentions += comparison.competitor_mention_count;

      // Count as "win" if competitor is superior
      if (comparison.comparison_type === 'superior_to_target') {
        competitor.winCount += 1;
      }

      // Add threats
      if (comparison.competitor_wins_on.length > 0) {
        comparison.competitor_wins_on.forEach(threat => competitor.threats.add(threat));
      }
    });
  });

  return Array.from(competitorMap.entries())
    .map(([competitor, data]) => ({
      competitor,
      winCount: data.winCount,
      totalMentions: data.totalMentions,
      threats: Array.from(data.threats),
      lastSeen: data.lastSeen
    }))
    .filter(c => c.totalMentions > 0)
    .sort((a, b) => b.winCount - a.winCount)
    .slice(0, 5);
}

// Extract strategic opportunities
export function getStrategicOpportunities(analyses: LLMBrandAnalysis[]): StrategicOpportunities {
  if (analyses.length === 0) {
    return {
      messagingOpportunities: [],
      contentGaps: [],
      totalOpportunities: 0
    };
  }

  const allMessagingOpps = analyses.flatMap(a => a.action_items.messaging_opportunities);
  const allContentGaps = analyses.flatMap(a => a.action_items.content_gaps);

  // Deduplicate and count frequencies
  const messagingCounts = allMessagingOpps.reduce((acc, opp) => {
    acc[opp] = (acc[opp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const contentGapCounts = allContentGaps.reduce((acc, gap) => {
    acc[gap] = (acc[gap] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topMessaging = Object.entries(messagingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([opp]) => opp);

  const topContentGaps = Object.entries(contentGapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([gap]) => gap);

  return {
    messagingOpportunities: topMessaging,
    contentGaps: topContentGaps,
    totalOpportunities: topMessaging.length + topContentGaps.length
  };
}

// Get recent insights
export function getRecentInsights(analyses: LLMBrandAnalysis[], limit: number = 5): RecentInsight[] {
  if (analyses.length === 0) {
    return [];
  }

  const insights: RecentInsight[] = [];

  // Take the most recent analyses (last 5)
  const recentAnalyses = analyses.slice(-Math.min(limit, analyses.length));

  recentAnalyses.forEach(analysis => {
    // Add top strength
    if (analysis.target_brand.brand_narrative.strengths_cited.length > 0) {
      insights.push({
        type: 'strength',
        message: analysis.target_brand.brand_narrative.strengths_cited[0] || '',
        timestamp: new Date().toISOString() // Use analysis timestamp if available
      });
    }

    // Add top weakness
    if (analysis.target_brand.brand_narrative.weaknesses_cited.length > 0) {
      insights.push({
        type: 'weakness',
        message: analysis.target_brand.brand_narrative.weaknesses_cited[0] || '',
        timestamp: new Date().toISOString()
      });
    }

    // Add opportunity
    if (analysis.action_items.messaging_opportunities.length > 0) {
      insights.push({
        type: 'opportunity',
        message: analysis.action_items.messaging_opportunities[0] || '',
        timestamp: new Date().toISOString()
      });
    }

    // Add threat
    if (analysis.action_items.competitive_threats.length > 0) {
      insights.push({
        type: 'threat',
        message: analysis.action_items.competitive_threats[0] || '',
        timestamp: new Date().toISOString()
      });
    }
  });

  return insights.slice(0, limit);
}

// Keep getTopDomains for Top Sources metric
export function getTopDomains(
  domainStats: Array<{
    domain: string;
    totalOccurrences: number;
    usedPercentageAcrossAllDomains: number;
    avgSourcesPerDomain: number;
  }>,
  limit: number
): DomainSummary[] {
  return domainStats
    .sort((a, b) => b.usedPercentageAcrossAllDomains - a.usedPercentageAcrossAllDomains)
    .slice(0, limit)
    .map((stat) => ({
      domain: stat.domain,
      usagePercentage: Math.round(stat.usedPercentageAcrossAllDomains * 100) / 100,
      avgCitations: Math.round(stat.avgSourcesPerDomain * 10) / 10,
    }));
}
