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
			"Missing OpenAI-compatible API key. Please set OPENAI_API_KEY in your environment " +
				"(when OPENAI_BASE_URL points at a gateway such as OpenRouter, use that gateway's key).",
		);
	}

	// baseURL is only passed when explicitly configured, so the default stays
	// the official OpenAI endpoint baked into the SDK.
	openaiClient = new ChatGptClient(
		env.OPENAI_BASE_URL ? { apiKey, baseURL: env.OPENAI_BASE_URL } : { apiKey },
	);
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
