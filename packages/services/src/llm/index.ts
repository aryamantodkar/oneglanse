import { EnvError } from "@oneglanse/errors";
import ChatGptClient from "openai";
import { env } from "../env.js";

let client: ChatGptClient | null = null;

function init(): ChatGptClient {
	if (client) return client;

	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new EnvError(
			"OPENAI_API_KEY",
			"Missing ChatGPT API key. Please set OPENAI_API_KEY in your environment.",
		);
	}

	client = new ChatGptClient({ apiKey });
	return client;
}

/**
 * Proxy defers client creation until first actual usage
 */
export const chatgpt = new Proxy({} as ChatGptClient, {
	get(_target, prop) {
		const instance = init();
		// @ts-expect-error – dynamic proxy passthrough
		return instance[prop];
	},
});
