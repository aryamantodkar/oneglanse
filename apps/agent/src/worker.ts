import { env } from "./env.js";
import { waitForRedis, CHAIN_QUEUE_NAME } from "@oneglanse/services";
import { Worker } from "bullmq";
import { handleChainJob } from "./worker/jobHandler.js";
import { logger } from "@oneglanse/utils";

// Exported so index.ts can call worker.close() during graceful shutdown.
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

	const connection = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	};

	const w = new Worker(
		CHAIN_QUEUE_NAME,
		async (job) => runSingleFlight(() => handleChainJob(job)),
		{
			connection,
			concurrency: 1,
			lockDuration: 30 * 60 * 1000, // 30 minutes — chain runs all providers sequentially
			stalledInterval: 60 * 1000,
			maxStalledCount: 5,
		},
	);

	w.on("active", (job) => {
		logger.log(`[chain] job started ${job.id}`);
	});

	w.on("completed", (job) => {
		logger.log(`[chain] job completed ${job.id}`);
	});

	w.on("failed", (job, err) => {
		logger.error(`[chain] job failed ${job?.id}`, err);
	});

	workers = [w];

	logger.log(`[agent] chain worker started → queue: ${CHAIN_QUEUE_NAME}`);
}

startWorkers().catch((err) => {
	logger.error("Workers failed to start:", err);
	process.exit(1);
});
