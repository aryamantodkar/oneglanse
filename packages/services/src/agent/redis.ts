import { DatabaseError } from "@oneglanse/errors";
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
	retryStrategy: (times) => {
		if (times > 10) return null;
		return Math.min(times * 200, 2_000);
	},
	lazyConnect: true,
});

redis.on("connect", () => {
	console.log("Redis connected");
});

redis.on("error", (err) => {
	console.log("Redis error", err);
});

export async function waitForRedis(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		try {
			await redis.ping();
			console.log("Redis ready");
			return;
		} catch {
			console.log("⏳ Waiting for Redis...");
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	throw new DatabaseError("Redis not available");
}
