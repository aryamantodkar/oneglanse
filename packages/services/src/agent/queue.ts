import { Queue } from "bullmq";

// Lazy initialization to avoid connection during build time
let _agentQueue: Queue | null = null;

function getAgentQueue(): Queue {
    if (!_agentQueue) {
        _agentQueue = new Queue("onescope-agent", {
            connection: {
                host: process.env.REDIS_HOST || "redis",
                port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
                password: process.env.REDIS_PASSWORD,
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 30000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        });
    }
    return _agentQueue;
}

// Export a proxy that lazily initializes the queue on first use
export const agentQueue: Queue = new Proxy({} as Queue, {
    get(_target, prop) {
        const instance = getAgentQueue();
        const value = instance[prop as keyof Queue];
        if (typeof value === "function") {
            return value.bind(instance);
        }
        return value;
    },
});