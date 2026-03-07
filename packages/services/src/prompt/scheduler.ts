import { pool } from "@oneglanse/db";
import { DatabaseError, toErrorMessage } from "@oneglanse/errors";
import type {
	ScheduleCronForPromptsArgs,
	UnscheduleCronForPromptsArgs,
} from "@oneglanse/types";
import { env } from "../env.js";

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
		const apiBaseUrlSql = await pool.query<{ sql: string }>(
			"SELECT format('ALTER ROLE CURRENT_USER SET app.api_base_url = %L', $1) AS sql",
			[apiBaseUrl],
		);
		const cronSecretSql = await pool.query<{ sql: string }>(
			"SELECT format('ALTER ROLE CURRENT_USER SET app.cron_secret = %L', $1) AS sql",
			[cronSecret],
		);

		const apiBaseUrlStatement = apiBaseUrlSql.rows[0]?.sql;
		const cronSecretStatement = cronSecretSql.rows[0]?.sql;
		if (!apiBaseUrlStatement || !cronSecretStatement) {
			throw new Error("failed to build ALTER ROLE statements");
		}

		await pool.query(apiBaseUrlStatement);
		await pool.query(cronSecretStatement);
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
		await pool.query("SELECT cron.unschedule($1);", [scheduleName]);
	} catch {
		// Schedule may not exist yet
	}

	await pool.query("SELECT cron.schedule($1, $2, $3);", [
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
		await pool.query("SELECT cron.unschedule($1);", [scheduleName]);
	} catch {
		// Schedule may not exist
	}
}
