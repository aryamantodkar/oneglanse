// New dashboard types for brand intelligence metrics

export interface BrandHealthScore {
  score: number; // 0-100 composite
  visibility: number; // 0-100
  sentiment: number; // 0-100
  recommendation: number; // 0-100
  trend: 'up' | 'down' | 'stable';
}

export interface CompetitivePosition {
  current: string; // market_leader, top_contender, solid_option, etc.
  shareOfVoice: number; // Percentage
  rank: number | null;
  competitorCount: number;
}

export interface SentimentInsights {
  positiveSignals: string[];
  negativeSignals: string[];
  topStrengths: string[];
  topWeaknesses: string[];
}

export interface CompetitiveThreat {
  competitor: string;
  winCount: number;
  totalMentions: number;
  threats: string[];
  lastSeen: string;
}

export interface StrategicOpportunities {
  messagingOpportunities: string[];
  contentGaps: string[];
  totalOpportunities: number;
}

export interface RecentInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  message: string;
  timestamp: string;
}

export interface DomainSummary {
  domain: string;
  usagePercentage: number;
  avgCitations: number;
}
