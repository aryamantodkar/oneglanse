import "dotenv/config";
import { Job, Worker } from "bullmq";
import { launchAgents } from "./agent.js";
import { AgentConfig } from "./types/types.js";
import { redis, waitForRedis } from "./redis.js";
import { logger } from "./lib/utils/logger.js";

async function startWorker() {
  await waitForRedis();

  const worker = new Worker(
    "onescope-agent",
    async (job: Job<AgentConfig>) => {
      const data = job.data as AgentConfig;
      const results = await launchAgents(data);

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
  process.exit(1); // PM2 will restart
});