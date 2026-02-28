import { clickhouse, pool } from "@oneglanse/db";
import { DatabaseError, toErrorMessage } from "@oneglanse/errors";
import type {
	DomainStats,
	FetchPromptResponsesForWorkspaceArgs,
	FetchPromptSourcesForWorkspaceArgs,
	FetchPromptSourcesForWorkspaceResult,
	FetchUserPromptsForWorkspaceArgs,
	ModelResult,
	PromptResponse,
	Provider,
	ScheduleCronForPromptsArgs,
	Source,
	StorePromptResponsesArgs,
	StorePromptsForWorkspaceArgs,
	UnscheduleCronForPromptsArgs,
	UserPrompt,
} from "@oneglanse/types";
import {
	extractDomainStats,
	extractSourceStats,
	formatDateToClickHouse,
} from "@oneglanse/utils";
import { v4 as uuidv4 } from "uuid";
import { env } from "../env.js";

// Private — shared batch-insert pattern: tries a single batch, falls back to
// individual inserts on failure, logs a summary, and optionally re-throws.
async function insertClickHouseWithFallback<T extends Record<string, unknown>>(
	table: string,
	values: T[],
	opts: {
		throwOnAllFailed?: boolean;
		onRecordFailed?: (value: T, err: unknown) => void;
	} = {},
): Promise<void> {
	const { throwOnAllFailed = false, onRecordFailed } = opts;
	try {
		await clickhouse.insert({ table, values, format: "JSONEachRow" });
	} catch (batchErr) {
		console.error(`⚠️ ClickHouse batch insert failed for ${table}:`, toErrorMessage(batchErr));
		let successCount = 0;
		for (const value of values) {
			try {
				await clickhouse.insert({ table, values: [value], format: "JSONEachRow" });
				successCount++;
			} catch (individualErr) {
				onRecordFailed?.(value, individualErr);
			}
		}
		console.warn(`${table}: ${successCount}/${values.length} records saved`);
		if (successCount === 0) {
			if (throwOnAllFailed) {
				throw new DatabaseError(`Failed to insert all records into ${table}`, {
					table,
					operation: "insert",
					count: values.length,
				});
			}
			console.error(`❌ All inserts failed for ${table}, but job will continue`);
		}
	}
}

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
				console.error(`Failed to insert prompt: "${value.prompt.slice(0, 50)}..."`);
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

/**
 * Writes the API base URL and cron secret into PostgreSQL GUCs so the
 * pg_cron job can read them via current_setting() without storing the
 * raw secret value in the cron.job table.
 *
 * Must be called once at service startup before any schedules are created.
 * Requires the DB role to have been granted ALTER on itself, or the call
 * must happen as a superuser role. Falls back to a no-op with a warning.
 */
export async function configureSchedulerSecrets(): Promise<void> {
	const apiBaseUrl = env.API_BASE_URL;
	const cronSecret = env.INTERNAL_CRON_SECRET;
	if (!apiBaseUrl || !cronSecret) {
		console.warn(
			"[scheduler] API_BASE_URL or INTERNAL_CRON_SECRET not set — cron schedules will not fire correctly",
		);
		return;
	}
	try {
		// current_user here is the app role; ALTER ROLE ... SET persists the GUC
		// for every future session opened by that role, including pg_cron workers.
		await pool.query(
			`ALTER ROLE CURRENT_USER SET app.api_base_url = $1`,
			[apiBaseUrl],
		);
		await pool.query(
			`ALTER ROLE CURRENT_USER SET app.cron_secret = $1`,
			[cronSecret],
		);
	} catch (err) {
		console.warn(
			"[scheduler] Could not persist GUCs via ALTER ROLE — cron secret may still be stored inline:",
			toErrorMessage(err),
		);
	}
}

export async function scheduleCronForPrompts(
	args: ScheduleCronForPromptsArgs,
): Promise<void> {
	const { workspaceId, userId, cronExpression } = args;

	const scheduleName = `auto_run_prompts_${workspaceId}`;

	// Secret and API URL are read at execution time via current_setting() so
	// they are NOT stored as literals in cron.job. configureSchedulerSecrets()
	// must have been called at startup to persist these GUCs for the app role.
	// workspaceId/userId are injected via format(%L, ...) to avoid raw interpolation.
	const builtSql = await pool.query<{ scheduled_sql: string }>(
		`
      SELECT format(
        $fmt$
        SELECT http_post(
          current_setting('app.api_base_url') || '/api/trpc/internal.runPrompts?batch=1',
          jsonb_build_object(
            '0',
            jsonb_build_object(
              'json',
              jsonb_build_object(
                'workspaceId', %L,
                'userId', %L
              )
            )
          ),
          jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
            'Content-Type', 'application/json'
          )
        );
        $fmt$,
        $1::text,
        $2::text
      ) AS scheduled_sql;
    `,
		[workspaceId, userId],
	);
	if (!builtSql.rows.length) {
		throw new Error("Failed to generate scheduled SQL");
	}
	
	const scheduledSQL = builtSql.rows[0]?.scheduled_sql;
	
	if (!scheduledSQL) {
		throw new DatabaseError("Failed to build cron scheduled SQL", {
			workspaceId,
			userId,
			operation: "schedule",
		});
	}

	// Remove existing schedule first (ignore errors if it doesn't exist)
	try {
		await pool.query(`SELECT cron.unschedule($1);`, [scheduleName]);
	} catch {
		// Schedule may not exist yet
	}

	await pool.query(`SELECT cron.schedule($1, $2, $3);`, [
		scheduleName,
		cronExpression,
		scheduledSQL,
	]);
}

export async function unscheduleCronForPrompts(
	args: UnscheduleCronForPromptsArgs,
): Promise<void> {
	const { workspaceId } = args;
	const scheduleName = `auto_run_prompts_${workspaceId}`;

	try {
		await pool.query(`SELECT cron.unschedule($1);`, [scheduleName]);
	} catch {
		// Schedule may not exist
	}
}

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

export async function fetchPromptResponsesForWorkspace(
	args: FetchPromptResponsesForWorkspaceArgs,
): Promise<PromptResponse[]> {
	const { workspaceId } = args;

	const result = await clickhouse.query({
		query: `
        SELECT *
        FROM analytics.prompt_responses
        WHERE workspace_id = {workspaceId:String}
      `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});

	const responses: PromptResponse[] = (await result.json()) as PromptResponse[];

	return responses;
}

export async function fetchPromptSourcesForWorkspace(
	args: FetchPromptSourcesForWorkspaceArgs,
): Promise<FetchPromptSourcesForWorkspaceResult> {
	const { workspaceId } = args;

	const promptResponses = await fetchPromptResponsesForWorkspace({ workspaceId });

	const domainStats = extractDomainStats(promptResponses);
	const sourceStats = extractSourceStats(promptResponses);

	return {
		domain_stats: domainStats,
		sourceStats: sourceStats,
	};
}

export async function fetchUserPromptsForWorkspace(
	args: FetchUserPromptsForWorkspaceArgs,
): Promise<UserPrompt[]> {
	const { workspaceId } = args;

	const result = await clickhouse.query({
		query: `
        SELECT *
        FROM analytics.user_prompts
        WHERE workspace_id = {workspaceId:String}
      `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});

	const data: UserPrompt[] = (await result.json()) as UserPrompt[];

	return data;
}
