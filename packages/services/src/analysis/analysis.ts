import { clickhouse } from "@onescope/db";
import type { AnalysisRecord, AnalysisResponse, AnalysisMetadata, BrandMetricMap, PromptAnalysis, PromptResponse, Source, AnalysisRow, LLMBrandAnalysis } from "@onescope/types";
import { runAnalysis } from "./runAnalysis.js";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceById } from "../workspace/index.js";

export async function analysePromptResponse(args: {
    workspaceId: string;
    response: string;
}): Promise<{
    brandMetrics: BrandMetricMap;
    fullAnalysis: LLMBrandAnalysis;
    targetBrandName: string;
}> {
    const { workspaceId, response } = args;

    const workspace = await getWorkspaceById({ workspaceId });

    const result = await runAnalysis({
        brandDomain: workspace.domain,
        brandName: workspace.name,
        response: response,
    });

    if (!result.data) {
        throw new Error("Analysis failed - no data returned");
    }

    const map: BrandMetricMap = {};
    const brand = result.data.target_brand;

    const visibilityScore = brand.visibility.visibility_score ?? 0;

    const positionScore = brand.visibility.rank;

    map[brand.brand_name] = {
        mentions: brand.brand_presence.total_mentions,
        sentiment: brand.sentiment.score,
        visibility: visibilityScore,
        position: positionScore,
        website: workspace.domain,
    };

    return {
        brandMetrics: map,
        fullAnalysis: result.data,
        targetBrandName: workspace.name,
    };
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
    let allErrors: Array<{ responseId: string; modelProvider: string; error: string }> = [];

    // If analyzeAll is true, loop until all responses are analyzed
    let hasMore = true;
    while (hasMore) {
        const result = await clickhouse.query({
            query: `
                SELECT *
                FROM analytics.prompt_responses
                WHERE workspace_id = {workspaceId:String}
                  AND user_id = {userId:String}
                  AND is_analysed = false
                LIMIT {batchSize:UInt32}
            `,
            query_params: { workspaceId, userId, batchSize },
            format: "JSONEachRow",
        });

        const responses: PromptResponse[] = await result.json();

        if (responses.length === 0) {
            break;
        }

        const analysisRows: PromptAnalysis[] = [];
        const responseIdsToMark: string[] = [];
        const errors: Array<{ responseId: string; modelProvider: string; error: string }> = [];

        // Analyze each response
        for (const resp of responses) {
            try {
                const analysisResult = await analysePromptResponse({
                    workspaceId: resp.workspace_id,
                    response: resp.response,
                });

                analysisRows.push({
                    id: uuidv4(),
                    prompt_id: resp.prompt_id,
                    workspace_id: resp.workspace_id,
                    user_id: resp.user_id,
                    model_provider: resp.model_provider,
                    brand_metrics: JSON.stringify(analysisResult.brandMetrics),
                    full_analysis: JSON.stringify(analysisResult.fullAnalysis),
                    prompt_run_at: resp.prompt_run_at,
                    created_at: resp.created_at
                });

                responseIdsToMark.push(resp.id);
            } catch (err: any) {
                const errorMessage = err?.message || String(err);
                console.error(`Failed to analyze response ${resp.id} (${resp.model_provider}):`, errorMessage);

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
              AND user_id = {userId:String}
              AND is_analysed = false
        `,
        query_params: { workspaceId, userId },
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
}): Promise<AnalysisResponse> {
    const { workspaceId, userId } = args;

    // Query from prompt_responses (source of truth) and join analysis data
    const result = await clickhouse.query({
        query: `
            SELECT
                pr.id,
                pr.prompt_id,
                pr.prompt_run_at,
                pr.user_id,
                pr.workspace_id,
                pr.model_provider,
                pr.response,
                pr.sources,
                pr.created_at,
                pr.is_analysed,
                if(pr.is_analysed, pa.brand_metrics, '{}') as brand_metrics,
                if(pr.is_analysed, pa.full_analysis, '[]') as full_analysis
            FROM analytics.prompt_responses pr
            ANY LEFT JOIN analytics.prompt_analysis pa
              ON pr.prompt_id = pa.prompt_id
              AND pr.prompt_run_at = pa.prompt_run_at
              AND pr.model_provider = pa.model_provider
              AND pr.workspace_id = pa.workspace_id
            WHERE pr.workspace_id = {workspaceId:String}
              AND pr.user_id = {userId:String}
            ORDER BY pr.prompt_run_at DESC
        `,
        query_params: { workspaceId, userId },
        format: "JSONEachRow",
    });

    const rows: any[] = await result.json();

    // Transform to flat array - handle both analyzed and unanalyzed
    const records: AnalysisRecord[] = rows.map((row) => ({
        id: row.id,
        prompt_id: row.prompt_id,
        prompt_run_at: row.prompt_run_at,
        user_id: row.user_id,
        workspace_id: row.workspace_id,
        model_provider: row.model_provider,
        response: row.response || "",
        sources: row.sources || [],
        brand_metrics: row.brand_metrics && row.brand_metrics !== '' && row.brand_metrics !== '{}'
            ? (typeof row.brand_metrics === "string" ? JSON.parse(row.brand_metrics) : row.brand_metrics)
            : {},
        full_analysis: row.full_analysis && row.full_analysis !== '' && row.full_analysis !== '{}' && row.full_analysis !== '[]'
            ? (typeof row.full_analysis === "string" ? JSON.parse(row.full_analysis) : row.full_analysis)
            : undefined,
        created_at: row.created_at,
        is_analysed: row.is_analysed ?? true,
    }));

    // Extract metadata in single pass
    const brandsSet = new Map<string, string>();
    const modelsSet = new Set<string>();

    for (const record of records) {
        // Collect unique brands (only from analyzed records)
        if (record.is_analysed && record.brand_metrics) {
            for (const [brandName, metrics] of Object.entries(record.brand_metrics)) {
                if (metrics && !brandsSet.has(brandName) && metrics.website) {
                    brandsSet.set(brandName, metrics.website);
                }
            }
        }

        // Collect unique models
        modelsSet.add(record.model_provider);
    }

    const metadata: AnalysisMetadata = {
        available_brands: Array.from(brandsSet, ([name, website]) => ({
            name,
            website,
        })),
        available_models: Array.from(modelsSet),
    };

    return {
        records,
        metadata,
    };
}
