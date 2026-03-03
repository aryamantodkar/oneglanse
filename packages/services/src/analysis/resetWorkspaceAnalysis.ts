import { clickhouse } from "@oneglanse/db";

/**
 * Clears derived analysis data for a workspace while preserving raw prompt responses.
 * - Deletes rows from analytics.prompt_analysis
 * - Resets analytics.prompt_responses.is_analysed to false
 */
export async function resetWorkspaceAnalysis(args: {
	workspaceId: string;
}): Promise<void> {
	const { workspaceId } = args;

	await clickhouse.command({
		query: `
            ALTER TABLE analytics.prompt_analysis
            DELETE WHERE workspace_id = {workspaceId:String}
        `,
		query_params: { workspaceId },
	});

	await clickhouse.command({
		query: `
            ALTER TABLE analytics.prompt_responses
            UPDATE is_analysed = false
            WHERE workspace_id = {workspaceId:String}
        `,
		query_params: { workspaceId },
	});
}
