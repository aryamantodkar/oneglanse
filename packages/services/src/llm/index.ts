import Anthropic from "@anthropic-ai/sdk";
import { EnvError } from "@oneglanse/errors";
import ChatGptClient from "openai";
import { env } from "../env.js";

let openaiClient: ChatGptClient | null = null;
let anthropicClient: Anthropic | null = null;

function initOpenai(): ChatGptClient {
	if (openaiClient) return openaiClient;

	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new EnvError(
			"OPENAI_API_KEY",
			"Missing ChatGPT API key. Please set OPENAI_API_KEY in your environment.",
		);
	}

	openaiClient = new ChatGptClient({ apiKey });
	return openaiClient;
}

function initAnthropic(): Anthropic {
	if (anthropicClient) return anthropicClient;

	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new EnvError(
			"ANTHROPIC_API_KEY",
			"Missing Anthropic API key. Please set ANTHROPIC_API_KEY in your environment.",
		);
	}

	anthropicClient = new Anthropic({ apiKey });
	return anthropicClient;
}

/**
 * Proxy defers client creation until first actual usage
 */
export const chatgpt = new Proxy({} as ChatGptClient, {
	get(_target, prop) {
		const instance = initOpenai();
		// @ts-expect-error – dynamic proxy passthrough
		return instance[prop];
	},
});

export const claude = new Proxy({} as Anthropic, {
	get(_target, prop) {
		const instance = initAnthropic();
		// @ts-expect-error – dynamic proxy passthrough
		return instance[prop];
	},
});
