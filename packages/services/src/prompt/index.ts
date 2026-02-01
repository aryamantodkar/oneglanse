import { clickhouse, pool , db, schema } from "@onescope/db";
import { v4 as uuidv4 } from "uuid";
import { and, eq, isNull } from "drizzle-orm";
import type { PromptResponse, DomainStats, UserPrompt, ModelResult, Provider } from "@onescope/types";
import { DatabaseError, NotFoundError } from "@onescope/errors";
import { formatDateToClickHouse, getCleanUrl, extractDomainStats, extractCitationStats } from "@onescope/utils";

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


export async function storePromptResponses(args: {
    results: ModelResult;
    userId: string;
    workspaceId: string;
    promptRunAt: string;
}) {
    const { results, userId, workspaceId, promptRunAt } = args;

    const values: Array<{
        id: string;
        prompt_id: string;
        user_id: string;
        workspace_id: string;
        model: string;
        model_provider: string;
        response: string;
        sources: Array<[string, string, string, string | null, string | null]>;
        prompt_run_at: string;
    }> = [];

    for (const [provider, result] of Object.entries(results) as [Provider, ModelResult[Provider]][]) {
        if (result.status !== "fulfilled") continue;

        for (const item of result.data) {
            values.push({
                id: uuidv4(),
                prompt_id: item.promptId,
                user_id: userId,
                workspace_id: workspaceId,
                model: provider,
                model_provider: provider,
                response: item.response,
                sources: item.sources.map((s) => [
                    s.title ?? "",
                    s.citedText ?? "",
                    s.url ?? "",
                    s.domain ?? null,
                    s.favicon ?? null,
                ]),
                prompt_run_at: formatDateToClickHouse(new Date(promptRunAt)),
            });
        }
    }

    if (values.length === 0) return;

    await clickhouse.insert({
        table: "analytics.prompt_responses",
        values,
        format: "JSONEachRow",
    });
}

export async function fetchPromptResponsesForWorkspace(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    const result = await clickhouse.query({
      query: `
        SELECT *
        FROM analytics.prompt_responses
        WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
      `,
      format: "JSONEachRow",
    });

    const data: PromptResponse[] = (await result.json()) as PromptResponse[];

    // const filePath = path.join(process.cwd(), "mockData", "prompt_responses.json");
    // const rawData = fs.readFileSync(filePath, "utf8");
    // const data: PromptResponse[] = JSON.parse(rawData);

    const domainStats = extractDomainStats(data);
    const citationStats = extractCitationStats(data);

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

    const data: UserPrompt[] = (await result.json()) as UserPrompt[];

    return data;
}
