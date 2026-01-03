import "server-only";

import { clickhouse, db, schema } from "@/server/db/index";
import { v4 as uuidv4 } from "uuid";
import { and, eq, isNull } from "drizzle-orm";
import type { PromptResponse, DomainStats, UserPrompt } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { AuthError, DatabaseError, fail, NotFoundError, ok, ValidationError } from "@/server/error";
import { pool } from "@/server/db/pg";
import { runWebSearch } from "@/server/services/prompt/_lib/pipeline/runWebSearch";
import { extractDomainStatsFromResponses } from "./_lib/stats/extractDomainStats";
import { extractCitationStatsFromResponses } from "./_lib/stats/extractCitationStats";
import { getCleanUrl } from "./_lib/format/getCleanUrl";
import { formatDateToClickHouse } from "./_lib/format/formatDateToClickhouse";

export async function askPromptsForWorkspace(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    const workspace = await db
      .select()
      .from(schema.workspaces)
      .where(
        and(
          eq(schema.workspaces.id, workspaceId),
          isNull(schema.workspaces.deletedAt)
        )
      )
      .execute();

    if (!workspace || workspace.length === 0) {
      throw new NotFoundError(`Workspace with ID ${workspaceId} not found.`); 
    }

    const workspaceData = workspace[0]; 
  
    const prompts = await clickhouse.query({
      query: `
        SELECT * 
        FROM analytics.user_prompts 
        WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
      `,
      format: 'JSONEachRow',
    });

    const promptsArray: UserPrompt[] = await prompts.json();

    if (!promptsArray || promptsArray.length === 0) {
      throw new NotFoundError(`No prompts found for this workspace.`); 
    }

     // LOGGER
    // const filePath = path.join(process.cwd(), "mockData", "llm_results.json");
    // const rawData = fs.readFileSync(filePath, "utf8");
    // const results = JSON.parse(rawData);

    // REAL DATA

    console.log("Calling run llms...");

    const results = await runWebSearch(promptsArray, {
      workspaceCountry: workspaceData?.country ?? "",
      workspaceRegion: workspaceData?.region ?? "",
    });

    console.log("results:", JSON.stringify(results, null, 2));

    const modelErrors = results.flatMap((r: { results: any; id: any; }) =>
      (r.results || [])
        .filter((res: { output: { error: any; }; }) => res.output?.error)
        .map((res: { model_provider: any; output: { error: any; }; }) => ({
          promptId: r.id,
          model: res.model_provider,
          error: res.output.error,
        }))
    );

    const values = results.flatMap((r: any) =>
      (r.results || []).flatMap((modelOutput: any) => {
        const metrics = modelOutput?.output?.metrics || [];
    
        if (modelOutput?.model_provider === "Anthropic") {
          const combinedResponse = metrics
            .map((m: any) => m.response?.trim())
            .filter(Boolean)
            .join("\n\n");
    
          const combinedCitations = [
            ...new Map(
              metrics
                .flatMap((m: any) =>
                  (m.citations || []).map((c: any) => {
                    const clean = getCleanUrl(c.url);
                    return [
                      `${clean}||${(c.cited_text || "").trim()}`,
                      {
                        ...c,
                        url: clean,
                        cited_text: c.cited_text?.trim() || "",
                      },
                    ];
                  })
                )
            ).values(),
          ];
    
          const combinedSources = [
            ...new Map(
              metrics
                .flatMap((m: any) =>
                  (m.sources || []).map((s: any) => {
                    const clean = getCleanUrl(s.url);
                    return [
                      `${clean}||${(s.title || "").trim()}`,
                      {
                        ...s,
                        url: clean,
                        title: s.title?.trim() || "",
                      },
                    ];
                  })
                )
            ).values(),
          ];
    
          return [
            {
              id: uuidv4(),
              prompt_id: r.id,
              user_id: userId,
              workspace_id: workspaceId,
              model: modelOutput?.output?.model || "",
              model_provider: modelOutput?.model_provider || "",
              response: combinedResponse || "",
              citations: combinedCitations,
              sources: combinedSources,
              prompt_run_at: formatDateToClickHouse(r.prompt_run_at),
              created_at: formatDateToClickHouse(new Date()),
            },
          ];
        }
    
        return metrics.map((metric: any) => ({
          id: uuidv4(),
          prompt_id: r.id,
          user_id: userId,
          workspace_id: workspaceId,
          model: modelOutput?.output?.model || "",
          model_provider: modelOutput?.model_provider || "",
          response: metric?.response || "",
          citations: (metric?.citations || []).map((c: any) => ({
            ...c,
            url: getCleanUrl(c.url),
          })),
          sources: (metric?.sources || []).map((s: any) => ({
            ...s,
            url: getCleanUrl(s.url),
          })),
          prompt_run_at: formatDateToClickHouse(r.prompt_run_at),
          created_at: formatDateToClickHouse(new Date()),
        }));
      })
    );

    try{
      await clickhouse.insert({
        table: "prompt_responses",
        values,
        format: "JSONEachRow", 
      })
    }
    catch(err){
      throw new DatabaseError("Failed to insert prompt responses.", { table: "prompt_responses", operation: "insert" , values});
    }

    return {
      response: values,
      modelErrors,
    };
}

export async function storePromptsForWorkspace(args: {
    prompts: string[];
    workspaceId: string;
    userId: string;
}) {
    const { prompts, workspaceId, userId } = args;

      const nonEmptyPrompts = prompts
        .map((p) => p.trim())
        .filter((p) => p !== "");

      const existing = await clickhouse.query({
        query: `
          SELECT prompt 
          FROM analytics.user_prompts 
          WHERE user_id = {userId:String} 
            AND workspace_id = {workspaceId:String}
        `,
        query_params: { userId, workspaceId },
        format: "JSONEachRow",
      })

      const existingRows = (await existing.json()) as Array<{ prompt: string }>;
      const existingPrompts = new Set(existingRows.map((r) => r.prompt));

      const promptsToInsert = nonEmptyPrompts.filter((p) => !existingPrompts.has(p));

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

        try{
          await clickhouse.insert({
            table: "analytics.user_prompts",
            values,
            format: "JSONEachRow",
          })
        }
        catch(err){
          throw new DatabaseError("Failed to insert user prompts", { table: "analytics.user_prompts", operation: "insert", values });
        }
      }

      if (promptsToDelete.length > 0) {
        await clickhouse.command({
          query: `
            ALTER TABLE analytics.user_prompts 
            DELETE WHERE user_id = {userId:String} 
              AND workspace_id = {workspaceId:String} 
              AND prompt IN ({promptsToDelete:Array(String)})
          `,
          query_params: {
            userId,
            workspaceId,
            promptsToDelete,
          },
        })
      }

      // scheduleCronForPrompts({ workspaceId, userId });

      return prompts;
}

export async function scheduleCronForPrompts(args: {
  workspaceId: string;
  userId: string;
}) {
      const { workspaceId, userId } = args;

      const scheduleName = `auto_run_prompts_${workspaceId}`;
      const cronExpression = "0 */12 * * *";

      const scheduledSQL = `
        SELECT http_post(
          '${process.env.API_BASE_URL}/api/trpc/internal.runPrompts?batch=1',
          jsonb_build_object(
            '0',
            jsonb_build_object(
              'json',
              jsonb_build_object(
                'workspaceId', '${workspaceId}',
                'userId', '${userId}'
              )
            )
          ),
          jsonb_build_object(
            'Authorization', 'Bearer ${process.env.INTERNAL_CRON_SECRET}',
            'Content-Type', 'application/json'
          )
        );
      `;

      await pool.query(
        `SELECT cron.unschedule($1);`,
        [scheduleName]
      );

      await pool.query(
        `SELECT cron.schedule($1, $2, $3);`,
        [scheduleName, cronExpression, scheduledSQL]
      );
}


export async function fetchPromptResponsesForWorkspace(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    // const result = await clickhouse.query({
    //   query: `
    //     SELECT *
    //     FROM analytics.prompt_responses
    //     WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
    //   `,
    //   format: "JSONEachRow",
    // });

    // const data: PromptResponse[] = (await result.json()) as PromptResponse[];

    const filePath = path.join(process.cwd(), "mockData", "prompt_responses.json");
    const rawData = fs.readFileSync(filePath, "utf8");
    const data: PromptResponse[] = JSON.parse(rawData);

    const domainStats = extractDomainStatsFromResponses(data);
    const citationStats = extractCitationStatsFromResponses(data);

    // LOGGER
    // const logPath = path.join(process.cwd(), "mockData", "fetchPromptResponses.json");

    // fs.writeFileSync(logPath, JSON.stringify(enriched, null, 2));

    return {
      responses: data,
      domain_stats: domainStats,
      citationStats: citationStats
    };
}

export async function fetchUserPromptsForWorkspace(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    const result = await clickhouse.query({
      query: `
        SELECT *
        FROM analytics.user_prompts
        WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
      `,
      format: "JSONEachRow",
    });

    const data = await result.json();

    const promptsArray = data.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      workspace_id: row.workspace_id,
      prompt: row.prompt,
      created_at: row.created_at,
    }));

    return promptsArray;
}