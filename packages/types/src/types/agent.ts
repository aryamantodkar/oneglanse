import type { Source } from "./sources";

// Agent-specific types shared between web and agent apps
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

export interface ExtractionResult {
  response: string;
  contentBlocks: ContentBlock[];
  inlineCitations: AgentCitation[];
  sources: Source[];
  hasSourcesButton: boolean;
  extractionErrors: string[];
}

export interface AskPromptResult {
  userId: string;
  workspaceId: string;
  promptId: string;
  prompt: string;
  response: string;
  sources: Source[];
}

export type ErrorPayload =
  | {
      type: "AUTH";
      message: string;
      status: 401;
      retryable: false;
    }
  | {
      type: "UNKNOWN";
      message: string;
      code?: string;
      status?: number;
      retryable?: boolean;
    };

export type AgentSuccess = {
  status: "fulfilled";
  data: AskPromptResult[];
};

export type AgentFailure = {
  status: "rejected";
  error: ErrorPayload;
};

export type AgentAuthErrorResult = {
  status: "auth_error";
  error: ErrorPayload;
};

export type Provider = "openai" | "anthropic" | "perplexity";

export type AgentResult =
  | { status: "fulfilled"; data: AskPromptResult[] }
  | { status: "rejected"; error: ErrorPayload };

export type ModelResult = Record<Provider, AgentResult>;