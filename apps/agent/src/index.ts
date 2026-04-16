import "./api.js";
import "./worker.js";
import { redis } from "@oneglanse/services";
import { workers } from "./worker.js";
import { logger } from "@oneglanse/utils";

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
		// Step 1: Stop accepting new jobs and wait for current jobs to finish.
		// Any jobs still in-flight when we exit will be drained on next startup
		// (drainQueues runs before workers start), so they do not restart automatically.
		if (workers.length > 0) {
			logger.log("[agent] Closing BullMQ workers (draining current jobs)...");
			await Promise.all(workers.map((w) => w.close()));
			logger.log("[agent] Workers closed.");
		}

		// Step 2: Close the Redis connection cleanly.
		// Must happen AFTER workers.close() because workers write job progress
		// to Redis as current jobs complete.
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

let isExiting = false;
process.on("unhandledRejection", (reason) => {
	logger.error("[agent] Unhandled rejection:", reason);
	if (!isExiting) {
		isExiting = true;
		// Delay exit to allow BullMQ to acknowledge in-flight job failures
		// before the process terminates, so jobs are not left in a stale state.
		setTimeout(() => process.exit(1), 3000).unref();
	}
});
