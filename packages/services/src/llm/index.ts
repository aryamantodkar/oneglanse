import { EnvError } from "@oneglanse/errors";
import OpenAI from "openai";

let client: OpenAI | null = null;

function init(): OpenAI {
	if (client) return client;

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new EnvError(
			"OPENAI_API_KEY",
			"Missing OpenAI API key. Please set OPENAI_API_KEY in your environment.",
		);
	}

	client = new OpenAI({ apiKey });
	return client;
}

/**
 * Proxy defers OpenAI creation until first actual usage
 */
export const openai = new Proxy({} as OpenAI, {
	get(_target, prop) {
		const instance = init();
		// @ts-expect-error – dynamic proxy passthrough
		return instance[prop];
	},
});
