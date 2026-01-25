import { Browser, Page } from "playwright";
import { AgentAuthError } from "../error/error.js";
import { PROVIDERS } from "../auth/config.js";

// Re-export shared types from the types package
export type {
  AgentUserPrompt as UserPrompt,
  AgentConfig,
  AgentCitation as Citation,
  ContentBlock,
  AgentSource as Source,
  ExtractionResult,
  AskPromptResult,
  AgentSuccess,
  AgentFailure,
  AgentResult as BaseAgentResult,
  ModelResult as BaseModelResult,
} from "@onescope/types";

// Agent-specific types that require playwright types
export type AgentContext = {
  name: Provider;
  browser: Browser;
  page: Page;
};

// Override AgentResult to include our specific error type
export type AgentResult =
  | { status: "fulfilled"; data: import("@onescope/types").AskPromptResult[] }
  | { status: "rejected"; error: Error }
  | AgentAuthError;

export type ModelResult = Record<Provider, AgentResult>;

export type Provider = keyof typeof PROVIDERS;
