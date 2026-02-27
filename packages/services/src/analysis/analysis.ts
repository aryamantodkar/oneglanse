import { clickhouse } from "@oneglanse/db";
import { toErrorMessage } from "@oneglanse/errors";
import type {
	AnalysisMetadata,
	AnalysisRecord,
	AnalysisResponse,
	AnalysisRow,
	BrandAnalysisResult,
	BrandMetricMap,
	PromptAnalysis,
	PromptResponse,
	Source,
} from "@oneglanse/types";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceById } from "../workspace/index.js";
import { runAnalysis } from "./runAnalysis.js";

export async function analysePromptResponse(args: {
	workspaceId: string;
	response: string;
	prompt: string;
	promptId?: string;
}): Promise<BrandAnalysisResult> {
	const { workspaceId, response, prompt, promptId } = args;

	const workspace = await getWorkspaceById({ workspaceId });

	const result = await runAnalysis({
		brandDomain: workspace.domain,
		brandName: workspace.name,
		response,
		prompt,
	});

	result.metadata = {
		brandName: workspace.name,
		brandDomain: workspace.domain,
		prompt: prompt,
		prompt_id: promptId || null,
		analyzedAt: new Date().toISOString(),
	};

	return result;
}

export async function analysePromptsForWorkspace(args: {
	workspaceId: string;
	userId: string;
	batchSize?: number;
	analyzeAll?: boolean; // New flag to process all batches
}): Promise<{
	analysedCount: number;
	failedCount: number;
	errors: Array<{ responseId: string; modelProvider: string; error: string }>;
	remainingCount: number;
}> {
	const { workspaceId, userId, batchSize = 50, analyzeAll = false } = args;

	let totalAnalyzed = 0;
	let totalFailed = 0;
	let allErrors: Array<{
		responseId: string;
		modelProvider: string;
		error: string;
	}> = [];

	// offset advances the cursor independently of ClickHouse mutation completion.
	// ALTER TABLE UPDATE is async — without OFFSET, the same rows are returned
	// every iteration until the background mutation finishes, causing duplicate
	// processing and a potential infinite loop.
	let offset = 0;
	let hasMore = true;
	while (hasMore) {
		const result = await clickhouse.query({
			query: `
                SELECT *
                FROM analytics.prompt_responses
                WHERE workspace_id = {workspaceId:String}
                  AND is_analysed = false
                LIMIT {batchSize:UInt32}
                OFFSET {offset:UInt32}
            `,
			query_params: { workspaceId, batchSize, offset },
			format: "JSONEachRow",
		});

		const responses: PromptResponse[] = await result.json();

		if (responses.length === 0) {
			break;
		}

		const analysisRows: PromptAnalysis[] = [];
		const responseIdsToMark: string[] = [];
		const errors: Array<{
			responseId: string;
			modelProvider: string;
			error: string;
		}> = [];

		// Analyze each response
		for (const resp of responses) {
			try {
				const analysisResult = await analysePromptResponse({
					workspaceId: resp.workspace_id,
					response: resp.response,
					prompt: resp.prompt,
					promptId: resp.prompt_id,
				});

				analysisRows.push({
					id: uuidv4(),
					prompt_id: resp.prompt_id,
					workspace_id: resp.workspace_id,
					prompt: resp.prompt,
					user_id: resp.user_id,
					model_provider: resp.model_provider,
					brand_analysis: JSON.stringify(analysisResult),
					prompt_run_at: resp.prompt_run_at,
					created_at: resp.created_at,
				});

				responseIdsToMark.push(resp.id);
			} catch (err) {
				const errorMessage = toErrorMessage(err);
				console.error(
					`Failed to analyze response ${resp.id} (${resp.model_provider}):`,
					errorMessage,
				);

				// Collect error details for frontend
				errors.push({
					responseId: resp.id,
					modelProvider: resp.model_provider,
					error: errorMessage,
				});
			}
		}

		if (analysisRows.length > 0) {
			await clickhouse.insert({
				table: "analytics.prompt_analysis",
				values: analysisRows,
				format: "JSONEachRow",
			});
		}

		if (responseIdsToMark.length > 0) {
			await clickhouse.command({
				query: `
                    ALTER TABLE analytics.prompt_responses
                    UPDATE is_analysed = true
                    WHERE id IN ({ids:Array(String)})
                `,
				query_params: { ids: responseIdsToMark },
			});
		}

		totalAnalyzed += analysisRows.length;
		totalFailed += errors.length;
		allErrors = allErrors.concat(errors);
		offset += batchSize;

		// If not analyzing all, stop after first batch
		if (!analyzeAll) {
			hasMore = false;
		} else {
			// Check if there are more to process
			hasMore = responses.length === batchSize;
		}
	}

	// Check remaining count
	const remainingResult = await clickhouse.query({
		query: `
            SELECT count() as count
            FROM analytics.prompt_responses
            WHERE workspace_id = {workspaceId:String}
              AND is_analysed = false
        `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});

	const remainingData: Array<{ count: string }> = await remainingResult.json();
	const remainingCount = Number(remainingData[0]?.count || 0);

	return {
		analysedCount: totalAnalyzed,
		failedCount: totalFailed,
		errors: allErrors,
		remainingCount,
	};
}

/**
 * Fetch ALL responses (analyzed and unanalyzed) with metadata
 */
export async function fetchAnalysedPrompts(args: {
	workspaceId: string;
	userId: string;
}): Promise<AnalysisRecord[]> {
	const { workspaceId } = args;

	// Query from prompt_responses (source of truth) and join analysis data
	const result = await clickhouse.query({
		query: `
            SELECT
                pr.id,
                pr.prompt_id,
                pr.prompt_run_at,
                pr.prompt,
                pr.user_id,
                pr.workspace_id,
                pr.model_provider,
                pr.response,
                pr.sources,
                pr.created_at,
                pr.is_analysed,
                if(pr.is_analysed, pa.brand_analysis, '[]') as brand_analysis
            FROM analytics.prompt_responses pr
            ANY LEFT JOIN analytics.prompt_analysis pa
              ON pr.prompt_id = pa.prompt_id
              AND pr.prompt_run_at = pa.prompt_run_at
              AND pr.model_provider = pa.model_provider
              AND pr.workspace_id = pa.workspace_id
            WHERE pr.workspace_id = {workspaceId:String}
            ORDER BY pr.prompt_run_at DESC
        `,
		query_params: { workspaceId },
		format: "JSONEachRow",
	});

	const rows: any[] = await result.json();

	// Transform to flat array - handle both analyzed and unanalyzed
	const records: AnalysisRecord[] = rows.map((row) => ({
		id: row.id,
		prompt_id: row.prompt_id,
		prompt: row.prompt,
		prompt_run_at: row.prompt_run_at,
		user_id: row.user_id,
		workspace_id: row.workspace_id,
		model_provider: row.model_provider,
		response: row.response || "",
		sources: row.sources || [],
		brand_analysis:
			row.brand_analysis &&
			row.brand_analysis !== "" &&
			row.brand_analysis !== "{}" &&
			row.brand_analysis !== "[]"
				? typeof row.brand_analysis === "string"
					? JSON.parse(row.brand_analysis)
					: row.brand_analysis
				: undefined,
		created_at: row.created_at,
		is_analysed: row.is_analysed ?? true,
	}));

	return records;
}

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
