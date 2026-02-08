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
}): Promise<{ analysedCount: number }> {
    const { workspaceId, userId } = args;

    const result = await clickhouse.query({
        query: `
            SELECT *
            FROM analytics.prompt_responses
            WHERE workspace_id = {workspaceId:String}
              AND user_id = {userId:String}
              AND is_analysed = false
        `,
        query_params: { workspaceId, userId },
        format: "JSONEachRow",
    });

    const responses: PromptResponse[] = await result.json();

    if (responses.length === 0) {
        return { analysedCount: 0 };
    }

    const analysisRows: PromptAnalysis[] = [];

    const responseIdsToMark: string[] = [];

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
        } catch (err) {
            console.error(`Failed to analyze response ${resp.id}:`, err);
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

    return { analysedCount: analysisRows.length };
}

/**
 * Fetch analysed prompts with metadata
 */
export async function fetchAnalysedPrompts(args: {
    workspaceId: string;
    userId: string;
}): Promise<AnalysisResponse> {
    const { workspaceId, userId } = args;

    // Single query - get everything in one go
    const result = await clickhouse.query({
        query: `
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
                pa.created_at
            FROM analytics.prompt_analysis pa
            LEFT JOIN analytics.prompt_responses pr
              ON pa.prompt_id = pr.prompt_id
              AND pa.prompt_run_at = pr.prompt_run_at
              AND pa.model_provider = pr.model_provider
              AND pa.workspace_id = pr.workspace_id
            WHERE pa.workspace_id = {workspaceId:String}
              AND pa.user_id = {userId:String}
            ORDER BY pa.prompt_run_at DESC
        `,
        query_params: { workspaceId, userId },
        format: "JSONEachRow",
    });

    const rows: AnalysisRow[] = await result.json();

    // Transform to flat array - single pass
    const records: AnalysisRecord[] = rows.map((row) => ({
        id: row.id,
        prompt_id: row.prompt_id,
        prompt_run_at: row.prompt_run_at,
        user_id: row.user_id,
        workspace_id: row.workspace_id,
        model_provider: row.model_provider,
        response: row.response || "",
        sources: row.sources || [],
        brand_metrics: typeof row.brand_metrics === "string"
            ? JSON.parse(row.brand_metrics)
            : row.brand_metrics,
        created_at: row.created_at,
    }));

    // Extract metadata in single pass
    const brandsSet = new Map<string, string>();
    const modelsSet = new Set<string>();

    for (const record of records) {
        // Collect unique brands
        for (const [brandName, metrics] of Object.entries(record.brand_metrics)) {
            if (!brandsSet.has(brandName) && metrics.website) {
                brandsSet.set(brandName, metrics.website);
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
