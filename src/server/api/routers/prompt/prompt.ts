import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { runLLMs } from "@lib/llmClient"; 

export const promptRouter = createTRPCRouter({
  ask: protectedProcedure
    .input(
      z.object({
        query: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { query } = input;

      const rawResults = await runLLMs(query);

      console.log("raw results", rawResults);

      return {
        rawResults
      };
    }),
});