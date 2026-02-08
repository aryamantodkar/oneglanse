import type { AnalysisRecord, UserPrompt } from "@onescope/types";
import type { BrandSummary, ModelStat, PromptWithCount, AnalysisStatus, DomainSummary } from "./types";

// Helper: Calculate average of numbers
function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

// 1. Aggregate brand metrics across all analysis records
export function aggregateBrandMetrics(records: AnalysisRecord[]): BrandSummary[] {
  const brandMap = new Map<
    string,
    {
      mentions: number[];
      sentiment: number[];
      visibility: number[];
      position: number[];
      website: string;
      sourceCount: number;
    }
  >();

  records.forEach((record) => {
    if (!record.brand_metrics) return;

    Object.entries(record.brand_metrics).forEach(([name, metrics]) => {
      if (!brandMap.has(name)) {
        brandMap.set(name, {
          mentions: [],
          sentiment: [],
          visibility: [],
          position: [],
          website: metrics.website,
          sourceCount: 0,
        });
      }

      const brand = brandMap.get(name)!;
      brand.mentions.push(metrics.mentions);
      // Convert sentiment from -1 to 1 scale to 0-100 scale for UI
      brand.sentiment.push((metrics.sentiment + 1) * 50);
      brand.visibility.push(metrics.visibility);
      brand.position.push(metrics.position);

      // Count sources that reference this brand's website
      if (record.sources) {
        brand.sourceCount += record.sources.filter((s) =>
          s.url?.includes(metrics.website)
        ).length;
      }
    });
  });

  return Array.from(brandMap.entries())
    .map(([name, data]) => ({
      name,
      website: data.website,
      avgMentions: Math.round(avg(data.mentions)),
      avgSentiment: Math.round(avg(data.sentiment)),
      avgVisibility: Math.round(avg(data.visibility)),
      avgPosition: Math.round(avg(data.position)),
      sourceCount: data.sourceCount,
    }))
    .sort((a, b) => b.avgVisibility - a.avgVisibility); // Sort by visibility
}

// 2. Aggregate model statistics
export function aggregateModelStats(records: AnalysisRecord[]): ModelStat[] {
  const modelCounts = records.reduce(
    (acc, record) => {
      const model = record.model_provider;
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = records.length || 1; // Avoid division by zero

  return Object.entries(modelCounts).map(([model, count]) => ({
    model,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

// 3. Get recent prompts with response counts
export function getRecentPrompts(
  prompts: UserPrompt[],
  records: AnalysisRecord[],
  limit: number
): PromptWithCount[] {
  // Create a map of prompt_id to response count
  const responseCounts = records.reduce(
    (acc, record) => {
      acc[record.prompt_id] = (acc[record.prompt_id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return prompts
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((prompt) => ({
      id: prompt.id,
      prompt: prompt.prompt,
      created_at: prompt.created_at,
      responseCount: responseCounts[prompt.id] || 0,
    }));
}

// 4. Calculate analysis status
export function calculateAnalysisStatus(records: AnalysisRecord[]): AnalysisStatus {
  const analyzed = records.filter((r) => r.is_analysed).length;
  const pending = records.filter((r) => !r.is_analysed).length;

  // Find most recent analysis timestamp
  const analysedRecords = records.filter((r) => r.is_analysed);
  const sortedRecords = analysedRecords.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const lastRun = sortedRecords.length > 0 ? sortedRecords[0]?.created_at ?? null : null;

  return {
    analyzed,
    pending,
    lastRun,
  };
}

// 5. Get top domains from domain stats
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
