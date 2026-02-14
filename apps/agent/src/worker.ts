import "./env.js";
import { Job, Worker } from "bullmq";
import { redis, waitForRedis, storePromptResponses, analysePromptsForWorkspace } from "@onescope/services";
import { logger } from "./lib/utils/logger.js";
import { AgentResult, ModelResult, PromptPayload, Provider, UserPrompt } from "@onescope/types";
import { agentHandler } from "./agents/lib/agentHandler.js";
import { openaiAgent } from "./agents/openai/openaiAgent.js";
import { anthropicAgent } from "./agents/anthropic/anthropicAgent.js";
import { perplexityAgent } from "./agents/perplexity/perplexityAgent.js";

type ProviderJobData = {
  jobGroupId: string;
  provider: Provider;
  prompts: UserPrompt[];
  user_id: string;
  workspace_id: string;
  created_at: string;
};

const providerConfig: Record<
  Provider,
  { label: string; factory: (options: { proxyPoolId: string }) => Promise<any> }
> = {
  openai: { label: "OpenAI", factory: openaiAgent },
  anthropic: { label: "Anthropic", factory: anthropicAgent },
  perplexity: { label: "Perplexity", factory: perplexityAgent },
};

async function startWorker() {
  await waitForRedis();

  const worker = new Worker(
    "onescope-agent",
    async (job: Job<ProviderJobData>) => {
      const data = job.data as ProviderJobData;

      const { provider, jobGroupId, prompts, user_id, workspace_id, created_at } = data;

      if (!providerConfig[provider]) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      if (!prompts || prompts.length === 0) {
        throw new Error("Agent job received no prompts");
      }

      const PromptPayload: PromptPayload = {
        user_id,
        workspace_id,
        prompts: prompts.map(({ id, prompt }) => ({
          id,
          prompt,
        })),
        created_at
      };

      const progressKey = `job:${jobGroupId}:result`;

      const ensureProgress = async () => {
        const raw = await redis.get(progressKey);
        if (raw) return JSON.parse(raw);

        const totalPromptsRequested = prompts.length;
        const expectedResponses = totalPromptsRequested * 3;
        const fallback = {
          status: "pending" as const,
          updateId: 0,
          providers: {
            openai: "pending",
            anthropic: "pending",
            perplexity: "pending",
          } as Record<Provider, "pending" | "running" | "completed" | "failed">,
          results: {
            openai: 0,
            anthropic: 0,
            perplexity: 0,
          } as Record<Provider, number>,
          stats: {
            totalPrompts: totalPromptsRequested,
            expectedResponses,
            actualResponses: 0,
          },
        };
        await redis.set(progressKey, JSON.stringify(fallback), "EX", 60 * 60);
        return fallback;
      };

      const progress = await ensureProgress();

      // Mark provider as running
      progress.providers[provider] = "running";
      await redis.set(progressKey, JSON.stringify(progress), "EX", 60 * 60);

      let wrapped: AgentResult = { status: "rejected", data: [] };

      try {
        const { label, factory } = providerConfig[provider];
        const result = await agentHandler(label, factory, PromptPayload, provider);
        wrapped = {
          status: result.length > 0 ? "fulfilled" : "rejected",
          data: result,
        };
      } catch (err: any) {
        logger.error(`${provider} failed:`, err?.message ?? err);
      }

      // Store successful results immediately
      if (wrapped.status === "fulfilled" && wrapped.data.length > 0) {
        const emptyResult: Record<Provider, AgentResult> = {
          openai: { status: "rejected", data: [] },
          anthropic: { status: "rejected", data: [] },
          perplexity: { status: "rejected", data: [] },
        };

        const partialResults: ModelResult = {
          ...emptyResult,
          [provider]: wrapped,
        };

        await storePromptResponses({
          results: partialResults,
          userId: user_id,
          workspaceId: workspace_id,
          promptRunAt: created_at,
        });

        // Auto-trigger analysis for this provider's responses immediately
        try {
          logger.log(`${provider} done for job group ${jobGroupId}, starting analysis...`);
          await analysePromptsForWorkspace({
            workspaceId: workspace_id,
            userId: user_id,
            analyzeAll: true,
          });
          logger.success(`Analysis completed after ${provider} for job group ${jobGroupId}`);
        } catch (err: any) {
          logger.error(`Analysis failed after ${provider} for job group ${jobGroupId}:`, err?.message ?? err);
        }
      }

      // Update progress
      progress.providers[provider] =
        wrapped.status === "fulfilled" ? "completed" : "failed";
      progress.results[provider] = wrapped.data.length;
      progress.stats.actualResponses = (Object.values(progress.results) as number[]).reduce(
        (sum, count) => sum + count,
        0
      );
      progress.updateId += 1;

      const allDone = (Object.values(progress.providers) as string[]).every(
        (state) => state === "completed" || state === "failed"
      );
      if (allDone) {
        progress.status = "completed";
      }

      await redis.set(progressKey, JSON.stringify(progress), "EX", 60 * 60);


      return true;
    },
    {
      connection: {
        host: process.env.REDIS_HOST || "redis",
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: 3, // one job per provider in parallel
      lockDuration: 2 * 60 * 1000, // Renew lock frequently to avoid long stale-lock windows
      stalledInterval: 30 * 1000, // Check stalled jobs every 30s
      maxStalledCount: 3, // Allow transient disconnects/restarts before hard-failing a job
    }
  );

  worker.on("completed", (job) => {
    logger.success("Job completed", job.id);
  });

  worker.on("failed", (job, err) => {
    logger.error("Job failed", job?.id, err);
  });
}

startWorker().catch((err) => {
  logger.error("Worker failed to start:", err);
  process.exit(1);  // Container will restart
});
