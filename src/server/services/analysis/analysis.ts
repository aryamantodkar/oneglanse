import { clickhouse, db } from "@/server/db/index";
import type { PromptAnalysis, PromptResponse } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AuthError, fail, ok, ValidationError } from "@/lib/error";

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

    const result = await clickhouse.query({
      query: `
        SELECT *
        FROM analytics.prompt_responses
        WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
      `,
      format: "JSONEachRow",
    });
    const responses: PromptResponse[] = await result.json();
    if (!responses.length) return fail("Could not fetch prompt responses for analysis.", 404);

    const groupedPrompts = Object.values(
      responses.reduce((acc, resp) => {
        const { prompt_id } = resp;
    
        if (!acc[prompt_id]) {
          acc[prompt_id] = {
            prompt_id,
            promptResponses: [],
          };
        }
    
        acc[prompt_id].promptResponses.push({
          id: resp.id,
          prompt_id: resp.prompt_id,
          user_id: resp.user_id,
          workspace_id: workspaceId,
          model: resp.model,
          modelProvider: resp.modelProvider,
          response: resp.response,
        });
    
        return acc;
      }, {} as Record<string, { prompt_id: string; promptResponses: PromptAnalysis[] }>)
    );  

    // MOCK DATA
    const filePath = path.join(process.cwd(), "mockData", "analyzedPrompts.json");
    const rawData = fs.readFileSync(filePath, "utf8");
    const analyzedPrompts = JSON.parse(rawData);

    const updates = analyzedPrompts.reduce(
      (
        acc: Record<
          string,
          Record<string, { brandMetrics: any; response: any }>
        >,
        prompt: { prompt_id: string | number; promptResponses: any[] }
      ) => {
        acc[prompt.prompt_id] = prompt.promptResponses.reduce<
          Record<string, { brandMetrics: any; response: any }>
        >((models, p: { modelProvider: string | number; brandMetrics: any; response: any }) => {
          models[p.modelProvider] = {
            brandMetrics: p.brandMetrics,
            response: p.response,
          };
          return models;
        }, {});
        return acc;
      },
      {} as Record<string, Record<string, { brandMetrics: any; response: any }>>
    );

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logPath = path.join(
      __dirname,
      "..", // analysis
      "..", // routers
      "..", // api
      "..", // server
      "..", // src
      "mockData",
      "updates.json"
    );

    fs.writeFileSync(logPath, JSON.stringify(updates, null, 2));


    // REAL DATA

    // const analyzedPrompts = await Promise.all(
    //   groupedPrompts.map(async (prompt) => {
    //     console.log("Analyzing combined responses...");
    //     const promptData = prompt.promptResponses.map(p => {
    //       return {
    //         modelProvider: p.modelProvider,
    //         response: p.response
    //       }
    //     })

    //     const analysisResults = await analyzeResponse(promptData);
    
    //     const analyzedResponses = prompt.promptResponses.map((resp) => {
    //       const normalizedModel = resp.modelProvider.trim().toLowerCase();
    //       const analysis = analysisResults[normalizedModel] || {};
    //       return {
    //         ...resp,
    //         brandMetrics: (analysis as any)?.brandMetrics ?? null,
    //       };
    //     });

    //     return { ...prompt, promptResponses: analyzedResponses };
    //   })
    // );

    // const updates = analyzedPrompts.reduce(
    //   (acc, prompt) => {
    //     acc[prompt.prompt_id] = prompt.promptResponses.reduce<
    //       Record<string, Record<string, any>>
    //     >((models, p) => {
    //       models[p.modelProvider] = p.brandMetrics; // ⬅️ direct assignment of metrics
    //       return models;
    //     }, {});
    //     return acc;
    //   },
    //   {} as Record<string, Record<string, Record<string, any>>>
    // );

    for (const [promptId, perModel] of Object.entries(updates)) {
      await clickhouse.query({
        query: `
          ALTER TABLE analytics.user_prompts
          UPDATE per_model = {per_model:JSON}
          WHERE id = {id:String}
            AND user_id = {user_id:String}
            AND workspace_id = {workspace_id:String}
        `,
        query_params: {
          per_model: JSON.stringify(perModel),
          id: promptId,
          user_id: userId,
          workspace_id: workspaceId,
        },
      });
    }

    return null;
}