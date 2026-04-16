import { getProviderQueue, getQueueName, redis, waitForRedis } from "@oneglanse/services";
import { PROVIDER_LIST } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { Worker } from "bullmq";
import { env } from "./env.js";
import { runWithProviderExecutionGate } from "./worker/executionGate.js";
import { handleJob, stopActiveProviderRun } from "./worker/jobHandler.js";

// Exported so index.ts can call worker.close() during graceful shutdown.
export let workers: Worker[] = [];
const WORKER_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;
const PROVIDER_STOP_CHANNEL = "oneglanse:agent:provider-stop";

async function drainQueues() {
	// Remove any waiting or active jobs left over from a previous run that was
	// killed before its jobs could complete. Without this, BullMQ's stall-check
	// would re-queue those jobs on startup and re-run providers the user never
	// explicitly triggered in this session.
	await Promise.all(
		PROVIDER_LIST.map(async (provider) => {
			try {
				const queue = getProviderQueue(provider);
				await queue.waitUntilReady();
				// drain() removes all waiting/delayed jobs
				await queue.drain();
				// clean() removes any jobs stuck in active state from the prior process
				await queue.clean(0, 1000, "active");
			} catch {
				// Non-fatal: if a queue can't be drained, log and continue
				logger.warn(`[agent] could not drain queue for ${provider} on startup`);
			}
		}),
	);
	logger.log("[agent] Queues drained — clean slate for this session.");
}

async function startWorkers() {
	await waitForRedis();
	await drainQueues();
	const stopSubscriber = redis.duplicate();
	await stopSubscriber.connect();
	await stopSubscriber.subscribe(PROVIDER_STOP_CHANNEL);
	stopSubscriber.on("message", (channel, message) => {
		if (channel !== PROVIDER_STOP_CHANNEL) return;
		void (async () => {
			try {
				const payload = JSON.parse(message) as {
					jobGroupId?: string;
					provider?: (typeof PROVIDER_LIST)[number];
				};
				if (!payload.jobGroupId || !payload.provider) {
					return;
				}
				await stopActiveProviderRun({
					jobGroupId: payload.jobGroupId,
					provider: payload.provider,
				});
			} catch (error) {
				logger.error("[agent] failed to process provider stop request", error);
			}
		})();
	});

	const connection = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	};

	workers = PROVIDER_LIST.map((provider) => {
		const queueName = getQueueName(provider);
		const worker = new Worker(
			queueName,
			(job) => runWithProviderExecutionGate(provider, () => handleJob(job)),
			{
				connection,
				concurrency: 1,
				lockDuration: WORKER_LOCK_DURATION_MS,
				stalledInterval: 60 * 1000,
				maxStalledCount: 5,
			},
		);

		worker.on("active", (job) => {
			// BullMQ fires "active" when the job is dequeued — before the stagger
			// delay and execution gate run. Real execution start is logged inside
			// runWithProviderExecutionGate after all gates are acquired.
			logger.debug(`[provider:${provider}] job queued ${job.id}`);
		});

		worker.on("completed", (job) => {
			logger.log(`[provider:${provider}] job completed ${job.id}`);
		});

		worker.on("failed", (job, err) => {
			logger.error(`[provider:${provider}] job failed ${job?.id}`, err);
		});

		logger.log(
			`[agent] provider worker started → queue: ${queueName} (concurrency=1, global_limit=1)`,
		);
		return worker;
	});
}

startWorkers().catch((err) => {
	logger.error("Workers failed to start:", err);
	process.exit(1);
});
