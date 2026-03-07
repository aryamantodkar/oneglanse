import type { Provider } from "@oneglanse/types";
import { Queue } from "bullmq";
import { env } from "../env.js";

const DEFAULT_JOB_OPTIONS = {
	attempts: 1,
	removeOnComplete: true,
	removeOnFail: false,
} as const;

const connection = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	password: env.REDIS_PASSWORD,
};

const queues = new Map<Provider, Queue>();

export function getQueueName(provider: Provider): string {
	return `oneglanse-agent-${provider}`;
}

export function getProviderQueue(provider: Provider): Queue {
	let q = queues.get(provider);
	if (!q) {
		q = new Queue(getQueueName(provider), {
			connection,
			defaultJobOptions: DEFAULT_JOB_OPTIONS,
		});
		queues.set(provider, q);
	}
	return q;
}
