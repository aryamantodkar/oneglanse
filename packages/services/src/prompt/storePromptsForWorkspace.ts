import { clickhouse } from "@oneglanse/db";
import type { StorePromptsForWorkspaceArgs } from "@oneglanse/types";
import { formatDateToClickHouse } from "@oneglanse/utils";
import { v4 as uuidv4 } from "uuid";
import { insertClickHouseWithFallback } from "./lib/insertClickHouseWithFallback.js";

export async function storePromptsForWorkspace(
	args: StorePromptsForWorkspaceArgs,
): Promise<string[]> {
	const { prompts, workspaceId, userId } = args;

	const nonEmptyPrompts = prompts.map((p) => p.trim()).filter((p) => p !== "");

	const existing = await clickhouse.query({
		query: `
          SELECT prompt
          FROM analytics.user_prompts
          WHERE workspace_id = {workspaceId:String}
        `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});

	const existingRows = (await existing.json()) as Array<{ prompt: string }>;
	const existingPrompts = new Set(existingRows.map((r) => r.prompt));

	const promptsToInsert = nonEmptyPrompts.filter(
		(p) => !existingPrompts.has(p),
	);

	const promptsToDelete = existingRows
		.map((r) => r.prompt)
		.filter((p) => !nonEmptyPrompts.includes(p));

	if (promptsToInsert.length > 0) {
		const values = promptsToInsert.map((p) => ({
			id: uuidv4(),
			user_id: userId,
			workspace_id: workspaceId,
			prompt: p,
			created_at: formatDateToClickHouse(new Date()),
		}));

		await insertClickHouseWithFallback("analytics.user_prompts", values, {
			throwOnAllFailed: true,
			onRecordFailed: (value) => {
				console.error(
					`Failed to insert prompt: "${value.prompt.slice(0, 50)}..."`,
				);
			},
		});
	}

	if (promptsToDelete.length > 0) {
		await clickhouse.command({
			query: `
            ALTER TABLE analytics.user_prompts
            DELETE WHERE workspace_id = {workspaceId:String}
              AND prompt IN ({promptsToDelete:Array(String)})
          `,
			query_params: {
				workspaceId,
				promptsToDelete,
			},
		});
	}

	return prompts;
}
