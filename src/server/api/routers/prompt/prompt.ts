import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { runLLMs } from "@/lib/llm/llmClient"; 
import { clickhouse, db, schema } from "@/server/db/index";
import { v4 as uuidv4 } from "uuid";
import { cronJobs } from "@/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { pool } from "@/server/db/pg";
import { TRPCError } from "@trpc/server";
import type { PromptResponse, UserPrompt } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { slidingWindowRateLimiter } from "@/server/middleware/rateLimiter";
import { makeError, makeResponse, safeHandler } from "@/lib/errorHandling/errorHandling";

function formatDateToClickHouse(dt: Date) {
  return dt.toISOString().slice(0, 19).replace("T", " "); 
  // => "2025-09-28 15:32:45"
}

export const promptRouter = createTRPCRouter({
  ask: publicProcedure
    .use(slidingWindowRateLimiter)
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string().optional()
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId, userId: inputUserId } = input;
        const userId = inputUserId ?? ctx.session?.user.id;

        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing workspaceId.",
          });
        }

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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Workspace with ID ${workspaceId} not found.`,
          });
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
          return makeError("No prompts found for this workspace.");
        }

        // MOCK DATA
        const filePath = path.join(process.cwd(), "mockData", "llm_results.json");
        const rawData = fs.readFileSync(filePath, "utf8");
        const results = JSON.parse(rawData);

        // REAL DATA

        // const results = await runLLMs(promptsArray, {
        //   workspaceCountry: workspaceData?.country ?? "",
        //   workspaceRegion: workspaceData?.region ?? "",
        // });

        // console.log("results:", JSON.stringify(results, null, 2));

        const modelErrors = results.flatMap((r: { results: any; id: any; }) =>
          (r.results || [])
            .filter((res: { output: { error: any; }; }) => res.output?.error)
            .map((res: { modelProvider: any; output: { error: any; }; }) => ({
              promptId: r.id,
              model: res.modelProvider,
              error: res.output.error,
            }))
        );

        const values = results.flatMap((r: any) =>
          (r.results || []).flatMap((modelOutput: any) => {
            const metrics = modelOutput?.output?.metrics || [];
        
            if (modelOutput?.modelProvider === "Anthropic") {
              const combinedResponse = metrics
                .map((m: any) => m.response?.trim())
                .filter(Boolean)
                .join("\n\n");
        
              const combinedCitations = [
                ...new Map(
                  metrics
                    .flatMap((m: any) => m.citations || [])
                    .map((c: any) => [c.url, c])
                ).values(),
              ];
        
              const combinedSources = [
                ...new Map(
                  metrics
                    .flatMap((m: any) => m.sources || [])
                    .map((s: any) => [s.url, s])
                ).values(),
              ];
        
              return [
                {
                  id: uuidv4(),
                  prompt_id: r.id,
                  user_id: userId,
                  workspace_id: workspaceId,
                  model: modelOutput?.output?.model || "",
                  modelProvider: modelOutput?.modelProvider || "",
                  response: combinedResponse || "",
                  citations: combinedCitations,
                  sources: combinedSources,
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
              modelProvider: modelOutput?.modelProvider || "",
              response: metric?.response || "",
              citations: metric?.citations || [],
              sources: metric?.sources || [],
              created_at: formatDateToClickHouse(new Date()),
            }));
          })
        );

        await clickhouse.insert({
          table: "prompt_responses",
          values,
          format: "JSONEachRow", 
        })

        return makeResponse(
          {
            response: values,
            modelErrors,
          },
          "Called ask procedure successfully."
        );
      })
    }),
  store: protectedProcedure
    .input(
      z.object({
        prompts: z.array(z.string()),
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { prompts, workspaceId } = input;
        const userId = ctx.session?.user.id;

        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing workspaceId.",
          });
        }

        const nonEmptyPrompts = prompts
            .map((p) => p.trim())
            .filter((p) => p !== "");

          // 1. Fetch existing prompts for this user/workspace
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

          // 2. Find prompts to insert (in input but not in DB)
          const promptsToInsert = nonEmptyPrompts.filter((p) => !existingPrompts.has(p));

          // 3. Find prompts to delete (in DB but not in input)
          const promptsToDelete = existingRows
            .map((r) => r.prompt)
            .filter((p) => !nonEmptyPrompts.includes(p));

          // 4. Insert new prompts
          if (promptsToInsert.length > 0) {
            const values = promptsToInsert.map((p) => ({
              id: uuidv4(),
              user_id: userId,
              workspace_id: workspaceId,
              prompt: p,
              per_model: {},
              created_at: formatDateToClickHouse(new Date()),
            }));

            await clickhouse.insert({
              table: "analytics.user_prompts",
              values,
              format: "JSONEachRow",
            })
          }

          // 5. Delete removed prompts
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

          const existingCron = await db
            .select()
            .from(cronJobs)
            .where(eq(cronJobs.workspaceId, workspaceId));

          if (existingCron.length === 0) {
            console.log("Calling LLMs for the first time.")
            const [jobRow] = await db
              .insert(cronJobs)
              .values({
                workspaceId,
                userId, // 👈 Save the owner user ID
                name: "Auto Run Prompts",
                cronExpression: "0 */12 * * *", // every 12 hours
                timezone: "UTC",
                targetType: "internal",
                targetPayload: { type: "runPrompts", userId }, // 👈 also embed owner ID in payload
                maxAttempts: 3,
              })
              .returning();

            if (!jobRow) throw new Error("Failed to insert cron job");

            await pool.query(`
              INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
              VALUES ('${jobRow.id}', '${workspaceId}', '{"type":"runPrompts","userId":"${userId}"}'::jsonb, 3);
            `);
          
            const scheduledSQL = `
              INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
              VALUES ('${jobRow.id}', '${workspaceId}', '{"type":"runPrompts","userId":"${userId}"}'::jsonb, 3);
            `;
            await pool.query(
              `SELECT cron.schedule($1, $2, $3);`,
              [`auto_run_prompts_${workspaceId}`, "0 */12 * * *", scheduledSQL]
            );
          }

          return makeResponse(prompts, "Prompts saved successfully.");
      })
    }),
  fetchPromptResponses: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId } = input;
        const userId = ctx.session?.user.id;
    
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing workspaceId.",
          });
        }
    
        // --- Helper to extract all URLs ---
        const extractUrlsFromResponse = (r: PromptResponse) => {
          const urls = new Set<string>();
    
          // 1️⃣ Citations — can be JSON or stringified tuples
          if (Array.isArray(r.citations)) {
            r.citations.forEach((c: any) => {
              if (typeof c === "string") {
                const match = c.match(/https?:\/\/[^\s')"]+/g);
                if (match) match.forEach(url => urls.add(url));
              } else if (c?.url) {
                urls.add(c.url);
              }
            });
          } else if (typeof r.citations === "string") {
            const match = (r.citations as string).match(/https?:\/\/[^\s')"]+/g);
            if (match) (match as string[]).forEach((url: string) => urls.add(url));
          }
  
          // 2️⃣ Sources — usually structured as array of {url,title}
          if (Array.isArray(r.sources)) {
            r.sources.forEach((s: any) => {
              if (s?.url) urls.add(s.url);
            });
          }
    
          // 3️⃣ Inline links in response text
          if (r.response) {
            const match = r.response.match(/https?:\/\/[^\s)]+/g);
            if (match) match.forEach(url => urls.add(url));
          }
    
          // Filter out invalid/duplicate ones
          return Array.from(urls).filter(u => /^https?:\/\/.+\..+/.test(u));
        };
    
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM analytics.prompt_responses
            WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
          `,
          format: "JSONEachRow",
        });
  
        const data: PromptResponse[] = (await result.json()) as PromptResponse[];
  
        const enriched = data.map(r => ({
          ...r,
          extractedUrls: extractUrlsFromResponse(r),
        }));
  
        return makeResponse(result, "Fetched prompt responses successfully.");
      })
    }),
  fetchUserPrompts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId } = input;
        const userId = ctx.session?.user.id;
    
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing workspaceId.",
          });
        }
    
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
          per_model: row.per_model ?? {},
          created_at: row.created_at,
        }));
  
        return makeResponse(promptsArray, "Fetched user prompts successfully.");
      })
    }),
});