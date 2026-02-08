import { clickhouse } from "@onescope/db";
import type { AnalysisRecord, AnalysisResponse, AnalysisMetadata, BrandMetricMap, PromptAnalysis, PromptResponse, Source, AnalysisRow } from "@onescope/types";
import { runAnalysis } from "./runAnalysis.js";
import { v4 as uuidv4 } from "uuid";

export async function analysePromptResponse(args: {
    response: string;
    sources: Source[];
}): Promise<BrandMetricMap> {
    const result = await runAnalysis({
        response: args.response,
        sources: args.sources,
    });

    if (!result.data) {
        throw new Error("Analysis failed - no data returned");
    }

    const map: BrandMetricMap = {};
    const brands = result.data.brands;

    for (const brand of brands) {
        const visibilityScore = brand.visibility.visibility_score;

        const positionScore = brand.visibility.rank;

        map[brand.brand_name] = {
            mentions: brand.mention_count,
            sentiment: brand.sentiment.score,
            visibility: visibilityScore,
            position: positionScore,
            website: brand.source_attributions[0]?.source_url
                ? new URL(brand.source_attributions[0].source_url).origin
                : "",
        };
    }

    return map;
}

export async function analysePromptsForWorkspace(args: {
    workspaceId: string;
    userId: string;
    batchSize?: number;
}): Promise<{
    analysedCount: number;
    failedCount: number;
    errors: Array<{ responseId: string; modelProvider: string; error: string }>;
    remainingCount: number;
}> {
    const { workspaceId, userId, batchSize = 50 } = args;

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
        return { analysedCount: 0, failedCount: 0, errors: [], remainingCount: 0 };
    }

    const analysisRows: PromptAnalysis[] = [];
    const responseIdsToMark: string[] = [];
    const errors: Array<{ responseId: string; modelProvider: string; error: string }> = [];

    // Analyze each response
    for (const resp of responses) {
        try {
            const sources: Source[] = resp.sources.map((s) => ({
                title: s.title,
                cited_text: s.cited_text,
                url: s.url,
                domain: s.domain,
                favicon: s.favicon,
            }));

            const brandMetrics = await analysePromptResponse({
                response: resp.response,
                sources,
            });

            analysisRows.push({
                id: uuidv4(),
                prompt_id: resp.prompt_id,
                workspace_id: resp.workspace_id,
                user_id: resp.user_id,
                model_provider: resp.model_provider,
                brand_metrics: JSON.stringify(brandMetrics),
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

    // Check if there are more unanalyzed responses
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
        analysedCount: analysisRows.length,
        failedCount: errors.length,
        errors,
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

    // Single optimized query using UNION ALL to get both analyzed and unanalyzed responses
    const result = await clickhouse.query({
        query: `
            -- Analyzed responses with metrics
            SELECT
                pa.id,
                pa.prompt_id,
                pa.prompt_run_at,
                pa.user_id,
                pa.workspace_id,
                pa.model_provider,
                pr.response,
                pr.sources,
                pa.brand_metrics,
                pa.created_at,
                true as is_analysed
            FROM analytics.prompt_analysis pa
            LEFT JOIN analytics.prompt_responses pr
              ON pa.prompt_id = pr.prompt_id
              AND pa.prompt_run_at = pr.prompt_run_at
              AND pa.model_provider = pr.model_provider
              AND pa.workspace_id = pr.workspace_id
            WHERE pa.workspace_id = {workspaceId:String}
              AND pa.user_id = {userId:String}

            UNION ALL

            -- Unanalyzed responses without metrics
            SELECT
                id,
                prompt_id,
                prompt_run_at,
                user_id,
                workspace_id,
                model_provider,
                response,
                sources,
                '{}' as brand_metrics,
                created_at,
                false as is_analysed
            FROM analytics.prompt_responses
            WHERE workspace_id = {workspaceId:String}
              AND user_id = {userId:String}
              AND is_analysed = false

            ORDER BY prompt_run_at DESC
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
        // Parse brand_metrics if present, otherwise empty object for unanalyzed
        brand_metrics: row.brand_metrics && row.brand_metrics !== ''
            ? (typeof row.brand_metrics === "string"
                ? JSON.parse(row.brand_metrics)
                : row.brand_metrics)
            : {},
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
