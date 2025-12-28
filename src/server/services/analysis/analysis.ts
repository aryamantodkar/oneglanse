import { clickhouse, db } from "@/server/db/index";
import type { AnalysedPrompt, AnalysisInput, AnalysisOutput, Citation, GroupedMetrics, PromptAnalysis, PromptResponse, Source, SourceCitationLookup } from "@/server/db/types";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { AuthError, fail, NotFoundError, ok, ValidationError } from "@/lib/error";
import { analyzeResponse } from "@/lib/llm/analyzeResponse";
import { v4 as uuidv4 } from "uuid";

export async function analysePromptsForWorkspace(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    if (!userId) {
      throw new AuthError("User Id is undefined.");
    }
    
    if (!workspaceId || workspaceId.trim() === "") {
      throw new ValidationError("Workspace ID is undefined.");
    }

    // const result = await clickhouse.query({
    //   query: `
    //     SELECT *
    //     FROM analytics.prompt_responses
    //     WHERE workspace_id = '${workspaceId}'
    //       AND user_id = '${userId}'
    //       AND (prompt_id, prompt_run_at) IN (
    //         SELECT prompt_id, prompt_run_at
    //         FROM analytics.prompt_responses pr
    //         LEFT JOIN analytics.prompt_analysis pa
    //           ON pr.prompt_id = pa.prompt_id
    //         AND pr.prompt_run_at = pa.prompt_run_at
    //         AND pr.workspace_id = pa.workspace_id
    //         WHERE pa.prompt_id IS NULL
    //           AND pr.workspace_id = '${workspaceId}'
    //           AND pr.user_id = '${userId}'
    //       )
    //   `,
    //   format: "JSONEachRow",
    // });
    // const responses: PromptResponse[] = await result.json();

    const filePath = path.join(process.cwd(), "mockData", "prompt_responses.json");
    const rawData = fs.readFileSync(filePath, "utf8");
    const responses: PromptResponse[] = JSON.parse(rawData);

    if (!responses.length) throw new NotFoundError("Could not fetch prompt responses for analysis.");

    const groupedPrompts = Object.values(
      responses.reduce(
        (
          acc: Record<
            string,
            {
              prompt_id: string;
              prompt_run_at: string;
              promptResponses: PromptAnalysis[];
            }
          >,
          resp
        ) => {
          const { prompt_id, prompt_run_at } = resp;
    
          const key = `${prompt_id}::${prompt_run_at}`;
    
          if (!acc[key]) {
            acc[key] = {
              prompt_id,
              prompt_run_at,
              promptResponses: [],
            };
          }
    
          let sourcesArray: Source[] = resp.sources.map(source => {
            return {
              title: source.title ?? "",
              url: source.url ?? "",
              page_age: source.page_age ?? ""
            }
          });

          const citationsArray: Citation[] = resp.citations.map(citation => ({
            title: citation.title ?? "",
            url: citation.url ?? "",
            start_index: citation.start_index ?? null,
            end_index: citation.end_index ?? null,
            cited_text: citation.cited_text ?? ""
          }));

          acc[key].promptResponses.push({
            id: resp.id,
            prompt_id: resp.prompt_id,
            user_id: resp.user_id,
            workspace_id: resp.workspace_id,
            model: resp.model,
            model_provider: resp.model_provider,
            response: resp.response,
            sources: sourcesArray,
            citations: citationsArray
          });
    
          return acc;
        },
        {}
      )
    );

    // MOCK DATA
    // const filePath = path.join(process.cwd(), "mockData", "analyzedPrompts.json");
    // const rawData = fs.readFileSync(filePath, "utf8");
    // const analyzedPrompts = JSON.parse(rawData);

    // const logPath = path.join(process.cwd(), "mockData", "groupedPrompts.json");

    // fs.writeFileSync(logPath, JSON.stringify(groupedPrompts, null, 2));


    // REAL DATA
    const analysisData = groupedPrompts.reduce(
      (
        acc: AnalysisInput,
        prompt
      ) => {
        const { prompt_id, prompt_run_at, promptResponses } = prompt;
    
        if (!acc[prompt_id]) acc[prompt_id] = {};
        if (!acc[prompt_id][prompt_run_at]) acc[prompt_id][prompt_run_at] = [];
    
        for (const p of promptResponses) {
          acc[prompt_id][prompt_run_at].push({
            model_provider: p.model_provider,
            response: p.response
          });
        }
    
        return acc;
      },
      {}
    );

    // REAL DATA
    // const llmResult = await analyzeResponse(analysisData);

    // if (!llmResult.data) {
    //   throw new Error("Analysis failed");
    // }

    // const analysisResults: AnalysisOutput  = llmResult.data;

    // MOCK DATA
    // const logPath2 = path.join(process.cwd(), "mockData", "metrics.json");

    // fs.writeFileSync(logPath2, JSON.stringify(analysisResults, null, 2));

    const filePath2 = path.join(process.cwd(), "mockData", "metrics.json");
    const rawData2 = fs.readFileSync(filePath2, "utf8");
    const analysisResults: AnalysisOutput = JSON.parse(rawData2);

    const responseLookup = new Map<string, SourceCitationLookup>();

    for (const prompt of groupedPrompts) {
      const { prompt_id, prompt_run_at, promptResponses } = prompt;

      for (const p of promptResponses) {
        const key = `${prompt_id}::${prompt_run_at}::${p.model_provider}`;

        responseLookup.set(key, {
          sources: p.sources,
          citations: p.citations,
        });
      }
    }

    const rows = [];

    for (const [promptId, runs] of Object.entries(analysisResults)) {
      if (typeof runs !== "object" || runs === null) continue;
      for (const [promptRunAt, models] of Object.entries(runs)) {
        if (!Array.isArray(models)) continue;
        for (const model of models) {
          if (
            !model?.model_provider ||
            !model?.brandMetrics ||
            typeof model.brandMetrics !== "object" ||
            Array.isArray(model.brandMetrics)
          ) {
            continue;
          }

          const key = `${promptId}::${promptRunAt}::${model.model_provider}`;

          const matched = responseLookup.get(key);

          if (!matched) {
            console.log("No sources/citations match found for", {
              promptId,
              promptRunAt,
              modelProvider: model.model_provider,
            });
          }

          let obj = {
            id: uuidv4(),
            prompt_id: promptId,
            workspace_id: workspaceId,
            user_id: userId,
            model_provider: model.model_provider,
            response: model.response,
            brand_metrics: model.brandMetrics,
            sources: matched?.sources ?? [],
            citations: matched?.citations ?? [],
            prompt_run_at: promptRunAt,
          };

          rows.push(obj);
        }
      }
    }

    await clickhouse.insert({
      table: "analytics.prompt_analysis",
      values: rows,
      format: "JSONEachRow",
    });

    return analysisResults;
}

export async function fetchAnalysedPrompts(args: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = args;

  if (!userId) {
    throw new AuthError("User Id is undefined.");
  }
  
  if (!workspaceId || workspaceId.trim() === "") {
    throw new ValidationError("Workspace ID is undefined.");
  }

  // const result = await clickhouse.query({
  //   query: `
  //     SELECT *
  //     FROM analytics.prompt_analysis
  //     WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
  //   `,
  //   format: "JSONEachRow",
  // });

  // const analysedPrompts: AnalysedPrompt[] = (await result.json()) as AnalysedPrompt[];

  // if(!analysedPrompts.length) throw new NotFoundError("Failed to fetch data from prompt_anaysis table.");

  const filePath2 = path.join(process.cwd(), "mockData", "promptAnalysis.json");
  const rawData2 = fs.readFileSync(filePath2, "utf8");
  const analysedPrompts = JSON.parse(rawData2);

  const result: GroupedMetrics = {};
  
  for (const row of analysedPrompts) {
    const {
      prompt_id,
      prompt_run_at,
      model_provider,
      response,
      brand_metrics,
      sources,
      citations,
    } = row;

    if (!result[prompt_id]) {
      result[prompt_id] = {};
    }

    if (!result[prompt_id][prompt_run_at]) {
      result[prompt_id][prompt_run_at] = [];
    }

    result[prompt_id][prompt_run_at].push({
      model_provider,
      response,
      brandMetrics: brand_metrics,
      sources,
      citations,
      promptRunAt: prompt_run_at
    });
  }

  const logPath2 = path.join(process.cwd(), "mockData", "finalMetrics.json");

  fs.writeFileSync(logPath2, JSON.stringify(result, null, 2));

  return result;
}