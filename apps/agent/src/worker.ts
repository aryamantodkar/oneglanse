import { env } from "./env.js";
import { waitForRedis, getQueueName } from "@oneglanse/services";
import { Worker } from "bullmq";
import { handleJob } from "./worker/jobHandler.js";
import { createProviderLogger, logger } from "@oneglanse/utils";
import { PROVIDER_LIST } from "@oneglanse/types";

// Exported so index.ts can call worker.close() during graceful shutdown.
// Empty until startWorkers() completes Redis readiness check and construction.
export let workers: Worker[] = [];

let executionChain: Promise<void> = Promise.resolve();

function runSingleFlight<T>(task: () => Promise<T>): Promise<T> {
	const scheduled = executionChain.then(task, task);
	executionChain = scheduled.then(
		() => undefined,
		() => undefined,
	);
	return scheduled;
}

async function startWorkers() {
	await waitForRedis();
	const workerConcurrency = 1;

	const connection = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	};

	workers = PROVIDER_LIST.map((provider) => {
		const plog = createProviderLogger(provider);
		const w = new Worker(
			getQueueName(provider),
			async (job) => runSingleFlight(() => handleJob(job)),
			{
				connection,
				// Keep per-provider workers/queues, but execute one job globally at a time.
				concurrency: workerConcurrency,
				lockDuration: 15 * 60 * 1000, // 15 minutes - browser automation can take time with retries
				stalledInterval: 60 * 1000, // Check stalled jobs every 60s
				maxStalledCount: 5, // Allow more stalls for browser automation with proxy retries
			},
		);

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
		`[agent] ${workers.length} workers started → queues: ${PROVIDER_LIST.map(getQueueName).join(", ")} (global single-worker mode)`,
	);
}

startWorkers().catch((err) => {
	logger.error("Workers failed to start:", err);
	process.exit(1); // Container will restart
});
