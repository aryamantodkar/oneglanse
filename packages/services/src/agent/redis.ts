import { DatabaseError, Logger } from "@oneglanse/errors";
import { Redis } from "ioredis";
import { env } from "../env.js";

export const redis = new Redis({
	host: env.REDIS_HOST,
	password: env.REDIS_PASSWORD,
	port: env.REDIS_PORT,
	connectTimeout: 10_000,
	commandTimeout: 10_000,
	maxRetriesPerRequest: 2,
	enableOfflineQueue: false,
	// Detect dead connections quickly after sleep/network change
	keepAlive: 10_000,
	// Re-queue commands that were in-flight when the connection dropped
	autoResendUnfulfilledCommands: true,
	retryStrategy: (times) => {
		if (times > 10) return null;
		return Math.min(times * 200, 2_000);
	},
	lazyConnect: true,
});

redis.on("connect", () => {
	Logger.info("Redis connected");
});

redis.on("error", (err) => {
	Logger.error("Redis error", err);
});

export async function waitForRedis(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		try {
			await redis.ping();
			Logger.info("Redis ready");
			return;
		} catch {
			Logger.info("Waiting for Redis...");
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	throw new DatabaseError("Redis not available");
}
