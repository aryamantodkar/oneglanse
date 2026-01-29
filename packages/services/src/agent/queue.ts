import { Queue } from "bullmq";

export const agentQueue = new Queue("onescope-agent", {
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