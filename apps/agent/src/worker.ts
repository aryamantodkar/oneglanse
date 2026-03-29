import { getQueueName, redis, waitForRedis } from "@oneglanse/services";
import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { Worker } from "bullmq";
import { env } from "./env.js";
import { cleanExpiredProfiles } from "./lib/browser/profileManager.js";
import {
	MAX_PARALLEL_PROVIDER_JOBS,
	runWithProviderExecutionGate,
} from "./worker/executionGate.js";
import { handleJob } from "./worker/jobHandler.js";

const PROFILE_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const AI_OVERVIEW_GEMINI_WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const AI_OVERVIEW_GEMINI_WAIT_POLL_MS = 1_000;

// Exported so index.ts can call worker.close() during graceful shutdown.
export let workers: Worker[] = [];
const WORKER_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;

type ProviderWorkerJobData = {
	jobGroupId?: string;
	provider?: Provider;
	runProviders?: Provider[];
};

type ProgressPayload = {
	providers?: Partial<
		Record<Provider, "pending" | "running" | "completed" | "failed">
	>;
};

function shouldAiOverviewWaitForGemini(
	jobData: ProviderWorkerJobData,
): boolean {
	return (
		jobData.provider === "ai-overview" &&
		Boolean(jobData.jobGroupId) &&
		(jobData.runProviders?.includes("gemini") ?? true)
	);
}

async function waitForGeminiBeforeAiOverview(
	jobData: ProviderWorkerJobData,
): Promise<void> {
	if (!shouldAiOverviewWaitForGemini(jobData) || !jobData.jobGroupId) {
		return;
	}

	const progressKey = `job:${jobData.jobGroupId}:result`;
	const deadline = Date.now() + AI_OVERVIEW_GEMINI_WAIT_TIMEOUT_MS;
	let loggedWait = false;

	while (Date.now() < deadline) {
		const raw = await redis.get(progressKey).catch(() => null);
		if (raw) {
			const parsed = JSON.parse(raw) as ProgressPayload;
			const geminiStatus = parsed.providers?.gemini;
			if (geminiStatus === "completed" || geminiStatus === "failed") {
				return;
			}
		}

		if (!loggedWait) {
			logger.log(
				`[ai-overview] waiting for gemini to finish first so AI Overview can reuse the shared Google session`,
			);
			loggedWait = true;
		}

		await new Promise<void>((resolve) =>
			setTimeout(resolve, AI_OVERVIEW_GEMINI_WAIT_POLL_MS),
		);
	}

	logger.warn(
		"[ai-overview] timed out waiting for gemini completion — continuing without guaranteed session reuse",
	);
}

async function startWorkers() {
	await waitForRedis();

	// Clean up profile directories from previous runs on startup, then
	// periodically so orphaned proxy-session profiles don't accumulate on disk.
	// With the 2-hour TTL and 10-minute sticky sessions, each cleanup cycle
	// removes profiles older than 2 hours (~12 rotations worth of directories).
	cleanExpiredProfiles().catch((err: unknown) =>
		logger.warn("startup profile cleanup failed:", String(err)),
	);
	setInterval(() => {
		cleanExpiredProfiles().catch((err: unknown) =>
			logger.warn("periodic profile cleanup failed:", String(err)),
		);
	}, PROFILE_CLEANUP_INTERVAL_MS).unref();

	const connection = {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	};

	workers = PROVIDER_LIST.map((provider) => {
		const queueName = getQueueName(provider);
		const worker = new Worker(
			queueName,
			async (job) => {
				await waitForGeminiBeforeAiOverview(job.data as ProviderWorkerJobData);
				return runWithProviderExecutionGate(provider, () => handleJob(job));
			},
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
			`[agent] provider worker started → queue: ${queueName} (concurrency=1, global_limit=${MAX_PARALLEL_PROVIDER_JOBS})`,
		);
		return worker;
	});
}

startWorkers().catch((err) => {
	logger.error("Workers failed to start:", err);
	process.exit(1);
});
