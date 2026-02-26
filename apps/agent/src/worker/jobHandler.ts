import { redis, storePromptResponses } from "@onescope/services";
import {
	PROVIDER_LIST,
	type AgentResult,
	type ModelResult,
	type PromptPayload,
	type Provider,
	type UserPrompt,
} from "@onescope/types";
import { type Job } from "bullmq";
import { agentHandler } from "../agents/core/agentHandler.js";
import { createAgent } from "../agents/core/createAgent.js";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { runHttpPrompts } from "../agents/google/ai-overview/runHttpPrompts.js";
import { logger } from "../lib/utils/logger.js";
import { runAnalysisInBackground } from "./analysis.js";

type ProviderJobData = {
	jobGroupId: string;
	provider: Provider;
	prompts: UserPrompt[];
	user_id: string;
	workspace_id: string;
	created_at?: string; // Optional - worker generates fresh timestamp if not provided
};

const providerConfig = Object.fromEntries(
	PROVIDER_LIST.map((p) => [
		p,
		{ label: AGENT_PROVIDER_CONFIG[p].label, factory: () => createAgent(p) },
	]),
) as Record<Provider, { label: string; factory: () => ReturnType<typeof createAgent> }>;

export async function handleJob(job: Job<ProviderJobData>): Promise<boolean> {
	const data = job.data as ProviderJobData;

	const { provider, jobGroupId, prompts, user_id, workspace_id } = data;

	if (!providerConfig[provider]) {
		throw new Error(`Unknown provider: ${provider}`);
	}

	if (AGENT_PROVIDER_CONFIG[provider].skip) {
		logger.warn(`[${provider}] skipped (skip: true in providerRegistry)`);
		return true;
	}

	if (!prompts || prompts.length === 0) {
		throw new Error("Agent job received no prompts");
	}

	// Generate fresh timestamp at execution time
	const executionTime = new Date().toISOString();

	const PromptPayload: PromptPayload = {
		user_id,
		workspace_id,
		prompts: prompts.map(({ id, prompt }) => ({
			id,
			prompt,
		})),
		created_at: executionTime,
	};

	const progressKey = `job:${jobGroupId}:result`;

	const ensureProgress = async () => {
		const raw = await redis.get(progressKey);
		if (raw) return JSON.parse(raw);

		const totalPromptsRequested = prompts.length;
		// Only initialize for the current provider
		const fallback = {
			status: "pending" as const,
			updateId: 0,
			providers: {
				[provider]: "pending",
			} as Record<Provider, "pending" | "running" | "completed" | "failed">,
			results: {
				[provider]: 0,
			} as Record<Provider, number>,
			stats: {
				totalPrompts: totalPromptsRequested,
				expectedResponses: totalPromptsRequested,
				actualResponses: 0,
			},
		};
		await redis.set(progressKey, JSON.stringify(fallback), "EX", 60 * 60);
		return fallback;
	};

	const progress = await ensureProgress();

	// Mark provider as running
	progress.providers[provider] = "running";
	await redis.set(progressKey, JSON.stringify(progress), "EX", 60 * 60);

	let wrapped: AgentResult = { status: "rejected", data: [] };

	// ── Google AI Overview: HTTP path via curl_cffi (no Playwright browser) ──
	if (provider === "google-ai-overview") {
		try {
			const httpResults = await runHttpPrompts(prompts, user_id, workspace_id);
			wrapped = {
				status: httpResults.length > 0 ? "fulfilled" : "rejected",
				data: httpResults,
			};
		} catch (err: any) {
			logger.error(`[google-ai-overview] HTTP handler failed:`, err?.message ?? err);
		}
	} else {
		// ── All other providers: Playwright browser path ───────────────────────
		try {
			const { label, factory } = providerConfig[provider];
			const result = await agentHandler(
				label,
				factory,
				PromptPayload,
				provider,
			);
			wrapped = {
				status: result.length > 0 ? "fulfilled" : "rejected",
				data: result,
			};
		} catch (err: any) {
			logger.error(`${provider} failed:`, err?.message ?? err);
		}
	}

	// Store successful results immediately
	if (wrapped.status === "fulfilled" && wrapped.data.length > 0) {
		const emptyResult = Object.fromEntries(
			PROVIDER_LIST.map((p) => [p, { status: "rejected" as const, data: [] }]),
		) as unknown as Record<Provider, AgentResult>;

		const partialResults: ModelResult = {
			...emptyResult,
			[provider]: wrapped,
		};

		await storePromptResponses({
			results: partialResults,
			userId: user_id,
			workspaceId: workspace_id,
			promptRunAt: executionTime,
		});

		// Trigger analysis asynchronously; do not block provider completion.
		runAnalysisInBackground({
			workspaceId: workspace_id,
			userId: user_id,
			provider,
			jobGroupId,
		});
	}

	// Update progress
	progress.providers[provider] =
		wrapped.status === "fulfilled" ? "completed" : "failed";
	progress.results[provider] = wrapped.data.length;
	progress.stats.actualResponses = (
		Object.values(progress.results) as number[]
	).reduce((sum, count) => sum + count, 0);
	progress.updateId += 1;

	const allDone = (Object.values(progress.providers) as string[]).every(
		(state) => state === "completed" || state === "failed",
	);
	if (allDone) {
		progress.status = "completed";
	}

	await redis.set(progressKey, JSON.stringify(progress), "EX", 60 * 60);

	return true;
}
