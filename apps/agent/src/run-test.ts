/**
 * Live extraction test — runs a prompt against each provider and prints
 * the extracted response so we can compare with what the browser shows.
 *
 * Usage: node --loader ts-node/esm src/run-test.ts [provider1 provider2 ...]
 * Example: node --loader ts-node/esm src/run-test.ts chatgpt claude
 */
import "./env.js";
import type { Provider } from "@oneglanse/types";
import { createAgent } from "./core/createAgent.js";
import { executePrompt } from "./core/prompt-runner/executePrompt.js";

const TEST_PROMPT = "What is the capital of France? Answer in one sentence.";

const ALL_PROVIDERS: Provider[] = ["chatgpt", "claude", "gemini", "perplexity"];

async function runForProvider(provider: Provider): Promise<void> {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`PROVIDER: ${provider}`);
	console.log(`PROMPT:   ${TEST_PROMPT}`);
	console.log("=".repeat(60));

	const { page, cleanup } = await createAgent(provider);
	try {
		const { response, sources } = await executePrompt(page, TEST_PROMPT, provider);
		console.log(`\n[${provider}] RESPONSE (${response.length} chars):\n`);
		console.log(response);
		console.log(`\n[${provider}] SOURCES (${sources.length}):`);
		for (const src of sources) {
			console.log(`  - ${src.url ?? src.title ?? "(no url)"}`);
		}
	} catch (err) {
		console.error(`[${provider}] ERROR:`, err instanceof Error ? err.message : err);
	} finally {
		await cleanup();
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2) as Provider[];
	const providers = args.length > 0 ? args : ALL_PROVIDERS;

	console.log(`Running live extraction test for: ${providers.join(", ")}`);

	// Run sequentially so browser sessions don't collide
	for (const provider of providers) {
		await runForProvider(provider);
	}

	console.log(`\n${"=".repeat(60)}\nDone.\n`);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
