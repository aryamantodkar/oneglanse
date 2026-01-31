import "./env.js";
import { Job, Worker } from "bullmq";
import { launchAgents } from "./agent.js";
import { redis, waitForRedis } from "@onescope/services";
import { logger } from "./lib/utils/logger.js";
import { PromptPayload, UserPrompt } from "@onescope/types";

async function startWorker() {
  await waitForRedis();

  const worker = new Worker(
    "onescope-agent",
    async (job: Job<UserPrompt[]>) => {
      const data = job.data as UserPrompt[];

      const first = data[0];
      if (!first) {
        throw new Error("Agent job received no prompts");
      }

      const { user_id, workspace_id, created_at } = first;

      const PromptPayload: PromptPayload = {
        user_id,
        workspace_id,
        prompts: data.map(({ id, prompt }) => ({
          id,
          prompt,
        })),
        created_at
      };

      const results = await launchAgents(PromptPayload);

      await redis.set(
        `job:${job.id}:result`,
        JSON.stringify({
          status: "completed",
          results,
        }),
        "EX",
        60 * 60 // 1 hour TTL
      );

      return true;
    },
    {
      connection: {
        host: process.env.REDIS_HOST || "redis",
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: 1, // 🔒 single Chrome profile
      lockDuration: 10 * 60 * 1000,
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