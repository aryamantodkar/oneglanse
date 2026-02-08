import type { UserPrompt } from "@onescope/types";

export interface BrandSummary {
  name: string;
  website: string;
  avgMentions: number;
  avgSentiment: number;
  avgVisibility: number;
  avgPosition: number;
  sourceCount: number;
}

export interface ModelStat {
  model: string;
  count: number;
  percentage: number;
}

export interface PromptWithCount {
  id: string;
  prompt: string;
  created_at: string;
  responseCount: number;
}

export interface AnalysisStatus {
  analyzed: number;
  pending: number;
  lastRun: string | null;
}

export interface DomainSummary {
  domain: string;
  usagePercentage: number;
  avgCitations: number;
}
