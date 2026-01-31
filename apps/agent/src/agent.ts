import { anthropicAgent } from "./agents/anthropic/anthropicAgent.js";
import { agentHandler } from "./agents/lib/agentHandler.js";
import { openaiAgent } from "./agents/openai/openaiAgent.js";
import { perplexityAgent } from "./agents/perplexity/perplexityAgent.js";
import { logger } from "./lib/utils/logger.js";
import { ModelResult, PromptPayload } from "@onescope/types";

export async function launchAgents(payload: PromptPayload): Promise<ModelResult> {
  logger.log("🚀 Starting Agents");

  const openaiResult = await agentHandler(
    "OpenAI",
    openaiAgent,
    payload,
    "openai"
  );

  const anthropicResult = await agentHandler(
    "Anthropic",
    anthropicAgent,
    payload,
    "anthropic"
  );

  const perplexityResult = await agentHandler(
    "Perplexity",
    perplexityAgent,
    payload,
    "perplexity"
  );


  return {
    openai: {
      status: "fulfilled",
      data: openaiResult
    },
    anthropic: {
      status: "fulfilled",
      data: anthropicResult
    },
    perplexity: {
      status: "fulfilled",
      data: perplexityResult
    },
  }
}