import "dotenv/config";
import { anthropicAgent } from "./agents/anthropic/anthropicAgent.js";
import { agentHandler } from "./agents/lib/agentHandler.js";
import { openaiAgent } from "./agents/openai/openaiAgent.js";
import { perplexityAgent } from "./agents/perplexity/perplexityAgent.js";
import { logger } from "./lib/utils/logger.js";
import { AgentConfig, ModelResult } from "./types/types.js";

export async function launchAgents(config: AgentConfig): Promise<ModelResult> {
  const { prompts } = config;

  logger.log("🚀 Starting Agents");

  const openaiResult = await agentHandler(
    "OpenAI",
    openaiAgent,
    prompts,
    "openai"
  );

  const anthropicResult = await agentHandler(
    "Anthropic",
    anthropicAgent,
    prompts,
    "anthropic"
  );

  const perplexityResult = await agentHandler(
    "Perplexity",
    perplexityAgent,
    prompts,
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