import { toErrorMessage } from "@oneglanse/errors";
import type {
	ModelResult,
	Provider,
	Source,
	StorePromptResponsesArgs,
} from "@oneglanse/types";
import { formatDateToClickHouse } from "@oneglanse/utils";
import { v4 as uuidv4 } from "uuid";
import { insertClickHouseWithFallback } from "./lib/insertClickHouseWithFallback.js";

export async function storePromptResponses(
	args: StorePromptResponsesArgs,
): Promise<void> {
	const { results, userId, workspaceId, promptRunAt } = args;

	const values: Array<{
		id: string;
		prompt_id: string;
		prompt: string;
		user_id: string;
		workspace_id: string;
		model: string;
		model_provider: string;
		response: string;
		sources: Source[];
		prompt_run_at: string;
	}> = [];

	for (const [provider, result] of Object.entries(results) as [
		Provider,
		ModelResult[Provider],
	][]) {
		if (result.status !== "fulfilled") continue;

		for (const item of result.data) {
			values.push({
				id: uuidv4(),
				prompt_id: item.promptId,
				prompt: item.prompt,
				user_id: userId,
				workspace_id: workspaceId,
				model: provider,
				model_provider: provider,
				response: item.response,
				sources: item.sources.map((s) => ({
					title: s.title ?? "",
					cited_text: s.cited_text ?? "",
					url: s.url ?? "",
					domain: s.domain ?? null,
					favicon: s.favicon ?? null,
				})),
				prompt_run_at: formatDateToClickHouse(new Date(promptRunAt)),
			});
		}
	}

	if (values.length === 0) return;

	await insertClickHouseWithFallback("analytics.prompt_responses", values, {
		throwOnAllFailed: false,
		onRecordFailed: (value, err) => {
			console.error(
				`Failed to insert record (prompt: "${value.prompt.slice(0, 50)}..."):`,
				toErrorMessage(err),
			);
			console.error("Problematic data:", {
				id: value.id,
				prompt_id: value.prompt_id,
				prompt: value.prompt.slice(0, 100),
				prompt_run_at: value.prompt_run_at,
				response_length: value.response.length,
				sources_count: value.sources.length,
			});
		},
	});
}
