import "./env.js";
import { waitForRedis } from "@oneglanse/services";
import { Worker } from "bullmq";
import { handleJob } from "./worker/jobHandler.js";
import { logger } from "./lib/utils/logger.js";

// Exported so index.ts can call worker.close() during graceful shutdown.
// Null until startWorker() completes Redis readiness check and construction.
export let worker: Worker | null = null;

async function startWorker() {
	await waitForRedis();
	const configuredConcurrency = Number.parseInt(
		process.env.AGENT_WORKER_CONCURRENCY ?? "1",
		10,
	);
	const workerConcurrency =
		Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
			? configuredConcurrency
			: 1;

	worker = new Worker("oneglanse-agent", handleJob, {
		connection: {
			host: process.env.REDIS_HOST || "redis",
			port: process.env.REDIS_PORT
				? Number.parseInt(process.env.REDIS_PORT, 10)
				: 6379,
			password: process.env.REDIS_PASSWORD,
		},
		// Default sequential execution to reduce Playwright/proxy contention.
		concurrency: workerConcurrency,
		lockDuration: 15 * 60 * 1000, // 15 minutes - browser automation can take time with retries
		stalledInterval: 60 * 1000, // Check stalled jobs every 60s
		maxStalledCount: 5, // Allow more stalls for browser automation with proxy retries
	});

	worker.on("completed", (job) => {
		logger.success("Job completed", job.id);
	});

	worker.on("failed", (job, err) => {
		logger.error("Job failed", job?.id, err);
	});
}

startWorker().catch((err) => {
	logger.error("Worker failed to start:", err);
	process.exit(1); // Container will restart
});
