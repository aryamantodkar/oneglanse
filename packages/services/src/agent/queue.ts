import { Queue } from "bullmq";

export const agentQueue = new Queue("onescope-agent", {
	connection: {
		host: process.env.REDIS_HOST || "redis",
		port: process.env.REDIS_PORT
			? Number.parseInt(process.env.REDIS_PORT, 10)
			: 6379,
		password: process.env.REDIS_PASSWORD,
	},
	defaultJobOptions: {
		attempts: 1,
		removeOnComplete: true,
		removeOnFail: false,
	},
});
