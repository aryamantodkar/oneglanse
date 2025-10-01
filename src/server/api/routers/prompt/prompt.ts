import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { runLLMs } from "@/lib/llmClient"; 
import { clickhouse } from "@/server/db/index";
import { v4 as uuidv4 } from "uuid";

function formatDateToClickHouse(dt: Date) {
  return dt.toISOString().slice(0, 19).replace("T", " "); 
  // => "2025-09-28 15:32:45"
}

type UserPrompt = {
  id: string;
  user_id: string;
  workspace_id: string;
  prompt: string;
  created_at: string;
};

interface PromptResponse {
  id: string;
  prompt_id: string;
  user_id: string;
  workspace_id: string;
  model: string;
  modelProvider: string;
  response: string;
  citations: any[];
  sources: any[];
  created_at: string;
}


export const promptRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId } = input;
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      const prompts = await clickhouse.query({
        query: `
          SELECT * 
          FROM analytics.user_prompts 
          WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
        `,
        format: 'JSONEachRow',
      });

      const promptsArray: UserPrompt[] = await prompts.json();

      const results = await runLLMs(promptsArray);

      const values = results.flatMap((r) =>
        r.results.flatMap((modelOutput: { modelProvider: string; output: any }) =>
          (modelOutput.output.metrics || []).map((metric: any) => ({
            id: uuidv4(),
            prompt_id: r.id,
            user_id: userId,
            workspace_id: workspaceId,
            model: modelOutput.output.model || "",
            modelProvider: modelOutput.modelProvider,
            response: metric.response || "",
            citations: metric.citations || [],
            sources: metric.sources || [],
            created_at: formatDateToClickHouse(new Date()),
          }))
        )
      );

      await clickhouse.insert({
        table: "prompt_responses",
        values,
        format: "JSONEachRow", 
      });

      return {
        success: true,
        inserted: values.length,
        prompts: values,
      };
    }),
  store: protectedProcedure
    .input(
      z.object({
        prompts: z.array(z.string()),
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { prompts, workspaceId } = input;
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }
  
      try {
        const nonEmptyPrompts = prompts.filter(p => p.trim() !== "");
  
        const values = nonEmptyPrompts.map(p => ({
          id: uuidv4(),
          user_id: userId,
          workspace_id: workspaceId,
          prompt: p.replace(/'/g, "''"),
          created_at: formatDateToClickHouse(new Date()),
        }));
  
        await clickhouse.insert({
          table: "user_prompts",
          values,
          format: "JSONEachRow", 
        });

        return {
          success: true,
          inserted: values.length,
          prompts: values,
        };
      } catch (err) {
        console.error("Failed to store prompts in ClickHouse:", err);
      }
    }),
  fetchPromptResponses: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId } = input;
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      try {
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM analytics.prompt_responses
            WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
          `,
          format: "JSONEachRow",
        });

        const data: PromptResponse[] = (await result.json()) as PromptResponse[];

        return {
          success: true,
          result: data,
        };
      } catch (err) {
        console.error("Failed to fetch prompts from ClickHouse:", err);
        return {
          success: false,
          result: [],
        };
      }
    }),
  fetchUserPrompts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId } = input;
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      try {
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM analytics.user_prompts
            WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
          `,
          format: "JSONEachRow",
        });

        const data = await result.json();

        const promptsArray: string[] = data.map((row: any) => row.prompt);

        return {
          success: true,
          prompts: promptsArray,
        };
      } catch (err) {
        console.error("Failed to fetch prompts from ClickHouse:", err);
        return {
          success: false,
          prompts: [],
        };
      }
    }),
});