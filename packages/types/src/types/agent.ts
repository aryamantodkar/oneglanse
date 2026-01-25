// Agent-specific types shared between web and agent apps

export type AgentUserPrompt = {
  id: string;
  prompt: string;
};

export interface AgentConfig {
  headless?: boolean;
  prompts: AgentUserPrompt[];
}

export interface AgentCitation {
  text: string;
  href?: string | null;
  title?: string | null;
  ariaLabel?: string | null;
  type?: "link" | "superscript" | "button";
}

export interface ContentBlock {
  text: string;
  tag: string;
  citations?: AgentCitation[];
}

export interface AgentSource {
  title: string;
  citedText: string;
  url: string;
  domain: string | null;
  favicon?: string | null;
}

export interface ExtractionResult {
  response: string;
  contentBlocks: ContentBlock[];
  inlineCitations: AgentCitation[];
  sources: AgentSource[];
  hasSourcesButton: boolean;
  extractionErrors: string[];
}

export interface AskPromptResult {
  promptId: string;
  prompt: string;
  response: string;
  sources: AgentSource[];
}

export type AgentSuccess = {
  status: "fulfilled";
  data: AskPromptResult[];
};

export type AgentFailure = {
  status: "rejected";
  error: Error;
};

export type AgentAuthErrorResult = {
  status: "auth_error";
  error: Error;
};

export type AgentResult = AgentSuccess | AgentFailure | AgentAuthErrorResult;

export type Provider = "openai" | "anthropic" | "perplexity";

export type ModelResult = Record<Provider, AgentResult>;
