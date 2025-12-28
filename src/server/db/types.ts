import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type * as schema from "./schema";
import type { db } from ".";

export type User = InferSelectModel<typeof schema.user>;
export type InsertUser = InferInsertModel<typeof schema.user>;

export type Session = InferSelectModel<typeof schema.session>;
export type InsertSession = InferInsertModel<typeof schema.session>;

export type Account = InferSelectModel<typeof schema.account>;
export type InsertAccount = InferInsertModel<typeof schema.account>;

export type Verification = InferSelectModel<typeof schema.verification>;
export type InsertVerification = InferInsertModel<typeof schema.verification>;

export type Organization = InferSelectModel<typeof schema.organization>;
export type InsertOrganization = InferInsertModel<typeof schema.organization>;

export type Member = InferSelectModel<typeof schema.member>;
export type InsertMember = InferInsertModel<typeof schema.member>;

export type Invitation = InferSelectModel<typeof schema.invitation>;
export type InsertInvitation = InferInsertModel<typeof schema.invitation>;

export type Workspace = InferSelectModel<typeof schema.workspaces>;
export type InsertWorkspace = InferInsertModel<typeof schema.workspaces>;

export type Competitor = InferSelectModel<typeof schema.competitors>;
export type InsertCompetitor= InferInsertModel<typeof schema.competitors>;

// API
export type UserPrompt = {
    id: string;
    user_id: string;
    workspace_id: string;
    prompt: string;
    created_at: string;
};
  
// Represents a response to a prompt
export interface PromptResponse {
    id: string;
    prompt_id: string;
    user_id: string;
    workspace_id: string;
    model: string;
    model_provider: string;
    response: string;
    citations: Array<{
      title: string;
      url: string;
      start_index?: number | null;
      end_index?: number | null;
      cited_text: string;
    }>;
    sources: Array<{
      title: string;
      url: string;
      page_age?: string | null;
    }>;
    prompt_run_at: string;
    created_at: string;
}

export interface PromptAnalysis {
  id: string;
  prompt_id: string;
  user_id: string;
  workspace_id: string;
  model: string;
  model_provider: string;
  response: string;
  sources: Source[];
  citations: Citation[];
}

export interface PromptResponseClient {
  id: string;
  prompt_id: string;
  user_id: string;
  workspace_id: string;
  model: string;
  model_provider: string;
  response: string;
  citations: any[];
  sources: any[];
  prompt_run_at: string;
  created_at: string;
}

export type DomainResponseClient = {
  responses: PromptResponseClient[],
  domain_stats: DomainStats[]
}

export interface WorkspaceLocation {
  workspaceCountry: string;
  workspaceRegion?: string | null;
}

export type ApiResponse<T> = {
  success: boolean;
  status: number;
  code?: string;
  message: string;
  data?: T | null;
  meta?: Record<string, unknown>;
};

export type Source = {
  title: string;
  url: string;
  page_age: string
};

export interface Citation {
  title: string;
  url: string;
  start_index: number | null;
  end_index: number | null;
  cited_text: string;
}

export type CitationGroupResult = {
  combined: GroupedCitation[];
  byModel: Record<string, GroupedCitation[]>;
};

export type CitationExcerpt = {
  cited_text: string;
  start_index: number | null;
  end_index: number | null;
  model_provider?: string;
};

export type GroupedCitation = {
  title: string;
  url: string;
  citations: CitationExcerpt[];
  totalCitations: number;
};

export type AnalysisModelInput = {
  model_provider: string;
  response: string;
};

export type AnalysisModelOutput = {
  model_provider: string;
  response: string;
  brandMetrics: Record<string, BrandMetric>;
};

export type AnalysisInput = Record<
  string,
  Record<
    string,
    AnalysisModelInput[]
  >
>;

export type AnalysisOutput= Record<
  string,
  Record<
    string,
    AnalysisModelOutput[]
  >
>;

export type BrandMetric = {
  mentions: number;
  sentiment: number; 
  visibility: number;
  position: number;    
  website: string;
};

export type BrandMetrics = Record<string, BrandMetric>;

export type AnalysedPrompt = {
  id: string;
  prompt_id: string;
  workspace_id: string;
  user_id: string;
  model_provider: string;
  brand_metrics: BrandMetrics; 
  prompt_run_at: string;              
  created_at: string;                
};

export type CompetitorInput = {
  name: string;
  slug: string;
  domain: string;
};

export type CompetitorsResponse = {
  competitors: Competitor[];
};

export type DomainStats = {
  domain: string;
  totalOccurrences: number;
  citationTextCount: number;
  usedPercentageAcrossAllDomains: number;
  avgCitationsPerDomain: number;
};

export type SourceCitationLookup = {
  sources: Source[];
  citations: Citation[];
};

export type GroupedMetrics = Record<
  string,
  Record<
    string,
    Metric[]
  >
>;

export type Metric = {
  model_provider: string;
  response: string;
  brandMetrics: Record<string, BrandMetric>;
  sources: Source[];
  citations: Citation[];
  promptRunAt: string;
};

export type ModelFilterDomainStats = {
  combined: DomainStats[];
  byModel: Record<string, DomainStats[]>;
};