import { Redis } from "ioredis";
import { logger } from "./lib/utils/logger.js";

export const redis = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: 6379,
    maxRetriesPerRequest: null,
    lazyConnect: true,
});
  
redis.on("connect", () => {
    logger.success("Redis connected");
});
  
redis.on("error", (err) => {
    logger.error("Redis error", err);
});

export async function waitForRedis() {
    for (let i = 0; i < 10; i++) {
      try {
        await redis.ping();
        logger.success("Redis ready");
        return;
      } catch {
        logger.log("⏳ Waiting for Redis...");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  
    throw new Error("Redis not available");
}