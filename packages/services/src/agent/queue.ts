import { Queue } from "bullmq";
import { env } from "../env.js";

export const agentQueue = new Queue("oneglanse-agent", {
	connection: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
	},
	defaultJobOptions: {
		attempts: 1,
		removeOnComplete: true,
		removeOnFail: false,
	},
});
