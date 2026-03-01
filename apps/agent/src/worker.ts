import { env } from "./env.js";
import { waitForRedis, getQueueName } from "@oneglanse/services";
import { Worker } from "bullmq";
import { handleJob } from "./worker/jobHandler.js";
import { createProviderLogger, logger } from "@oneglanse/utils";
import { PROVIDER_LIST } from "@oneglanse/types";

// Exported so index.ts can call worker.close() during graceful shutdown.
// Empty until startWorkers() completes Redis readiness check and construction.
export let workers: Worker[] = [];

async function startWorkers() {
	await waitForRedis();
	const configuredConcurrency = env.AGENT_WORKER_CONCURRENCY;
	const workerConcurrency =
		Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
			? configuredConcurrency
			: 1;

	const connection = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	};

	workers = PROVIDER_LIST.map((provider) => {
		const plog = createProviderLogger(provider);
		const w = new Worker(getQueueName(provider), handleJob, {
			connection,
			// Sequential per-provider to avoid Playwright/proxy contention within a provider.
			concurrency: workerConcurrency,
			lockDuration: 15 * 60 * 1000, // 15 minutes - browser automation can take time with retries
			stalledInterval: 60 * 1000, // Check stalled jobs every 60s
			maxStalledCount: 5, // Allow more stalls for browser automation with proxy retries
		});

		w.on("active", (job) => {
			plog.log("Job started", job.id);
		});

		w.on("completed", (job) => {
			plog.success("Job completed", job.id);
		});

		w.on("failed", (job, err) => {
			plog.error("Job failed", job?.id, err);
		});

		return w;
	});

	logger.log(
		`[agent] ${workers.length} workers started → queues: ${PROVIDER_LIST.map(getQueueName).join(", ")}`,
	);
}

startWorkers().catch((err) => {
	logger.error("Workers failed to start:", err);
	process.exit(1); // Container will restart
});
