import { Redis } from "ioredis";

export const redis = new Redis({
	host: process.env.REDIS_HOST || "redis",
	password: process.env.REDIS_PASSWORD,
	port: 6379,
	maxRetriesPerRequest: null,
	lazyConnect: true,
});

redis.on("connect", () => {
	console.log("Redis connected");
});

redis.on("error", (err) => {
	console.log("Redis error", err);
});

export async function waitForRedis() {
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

	throw new Error("Redis not available");
}
