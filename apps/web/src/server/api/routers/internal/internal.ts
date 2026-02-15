import "server-only";

import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter } from "@/server/api/trpc";
import { internalProcedure } from "../../procedures";
import { agentQueue, fetchUserPromptsForWorkspace, redis, getWorkspaceById } from "@onescope/services";
import { ok, safeHandler } from "@onescope/errors";
import type { Provider } from "@onescope/types";

export const internalRouter = createTRPCRouter({
  runPrompts: internalProcedure
    .input(z.object({
      workspaceId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return safeHandler(async () => {
        const { workspaceId, userId } = input;

        const prompts = await fetchUserPromptsForWorkspace({ workspaceId, userId });

        if (!prompts || prompts.length === 0) {
          return ok({ jobId: null as string | null, status: "empty" }, "No prompts to run.");
        }

        const jobGroupId = randomUUID();

        // Fetch workspace and parse enabled providers
        const workspace = await getWorkspaceById({ workspaceId });
        const enabledProvidersJson = workspace.enabledProviders ?? '["openai","anthropic","perplexity","google"]';
        const enabledProviders = JSON.parse(enabledProvidersJson) as Provider[];

        const progress = {
          status: "pending" as const,
          updateId: 0,
          providers: Object.fromEntries(
            enabledProviders.map(p => [p, "pending"])
          ) as Record<string, string>,
          results: Object.fromEntries(
            enabledProviders.map(p => [p, 0])
          ) as Record<string, number>,
          stats: {
            totalPrompts: prompts.length,
            expectedResponses: prompts.length * enabledProviders.length,
            actualResponses: 0,
          },
        };

        await redis.set(
          `job:${jobGroupId}:result`,
          JSON.stringify(progress),
          "EX",
          60 * 60
        );

        await Promise.all(
          enabledProviders.map((provider) =>
            agentQueue.add("run-agent", {
              jobGroupId,
              provider,
              prompts,
              user_id: userId,
              workspace_id: workspaceId,
            })
          )
        );

        return ok({ jobId: jobGroupId, status: "queued" }, "Prompts queued successfully.");
      });
    }),
});
