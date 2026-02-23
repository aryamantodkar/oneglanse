import "./worker.js";
import { redis } from "@onescope/services";
import { worker } from "./worker.js";
import { logger } from "./lib/utils/logger.js";

const shutdown = async (signal: string) => {
	logger.log(`[agent] Received ${signal}. Starting graceful shutdown...`);

	// Force-exit after 15 minutes so a genuinely stuck job never blocks container
	// replacement indefinitely. Must be less than stop_grace_period in docker-compose.yml
	// (set to 16m) so this fires first and we get a clean log before Docker sends SIGKILL.
	const forceExitTimer = setTimeout(() => {
		logger.error("[agent] Graceful shutdown timed out after 15m. Forcing exit.");
		process.exit(1);
	}, 15 * 60 * 1000);

	try {
		// Step 1: Stop accepting new jobs and wait for the current job to finish.
		// BullMQ re-queues any job that was picked up but not acknowledged, so
		// nothing is lost — the next worker restart will retry it.
		if (worker) {
			logger.log("[agent] Closing BullMQ worker (draining current job)...");
			await worker.close();
			logger.log("[agent] Worker closed.");
		}

		// Step 2: Close the Redis connection cleanly.
		// Must happen AFTER worker.close() because the worker writes job progress
		// to Redis as the current job completes.
		logger.log("[agent] Closing Redis connection...");
		await redis.quit();
		logger.log("[agent] Redis connection closed.");

		clearTimeout(forceExitTimer);
		logger.success("[agent] Graceful shutdown complete.");
		process.exit(0);
	} catch (err) {
		logger.error("[agent] Shutdown error:", err);
		clearTimeout(forceExitTimer);
		process.exit(1);
	}
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGQUIT", () => void shutdown("SIGQUIT"));

process.on("uncaughtException", (err) => {
	logger.error("[agent] Uncaught exception:", err);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	logger.error("[agent] Unhandled rejection:", reason);
	process.exit(1);
});
