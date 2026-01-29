import { Redis } from "ioredis";

// Lazy initialization to avoid connection during build time
let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        _redis = new Redis({
            host: process.env.REDIS_HOST || "redis",
            port: 6379,
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });

        _redis.on("connect", () => {
            console.log("Redis connected");
        });

        _redis.on("error", (err) => {
            console.log("Redis error", err);
        });
    }
    return _redis;
}

// Export a proxy that lazily initializes Redis on first use
export const redis: Redis = new Proxy({} as Redis, {
    get(_target, prop) {
        const instance = getRedis();
        const value = instance[prop as keyof Redis];
        if (typeof value === "function") {
            return value.bind(instance);
        }
        return value;
    },
});

export async function waitForRedis() {
    const client = getRedis();
    for (let i = 0; i < 10; i++) {
        try {
            await client.ping();
            console.log("Redis ready");
            return;
        } catch {
            console.log("⏳ Waiting for Redis...");
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    throw new Error("Redis not available");
}