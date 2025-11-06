// src/server/redis/redis.ts
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = createClient({
  url: redisUrl,
});

redis.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

async function initRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log(`✅ Connected to Redis at ${redisUrl}`);
  }
}

initRedis().catch(console.error);