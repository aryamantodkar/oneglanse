import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { calculateSentiment, type SourceItem } from "@/lib/calculateSentiment";
import { clickhouse } from "@/server/db/index";
import type { PromptResponse } from "../prompt/prompt";

export const sentimentRouter = createTRPCRouter({
  analyzeSentiment: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId } = input;
      const userId = ctx.session?.user.id;
      if (!userId) throw new Error("Unauthorized");

      try {
        // 1️⃣ Fetch all prompt responses for workspace
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM analytics.prompt_responses
            WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'
          `,
          format: "JSONEachRow",
        });

        const responses: PromptResponse[] = await result.json();
        if (!responses.length) return { success: true, prompts: [] };

        // 2️⃣ Helper to extract URLs from each response
        const extractUrlsFromResponse = (r: PromptResponse) => {
          const urls = new Set<string>();
          if (Array.isArray(r.citations)) r.citations.forEach(c => c?.url && urls.add(c.url));
          if (Array.isArray(r.sources)) r.sources.forEach(s => s?.url && urls.add(s.url));
          if (r.response) r.response.match(/https?:\/\/[^\s)]+/g)?.forEach(u => urls.add(u));
          return Array.from(urls).filter(u => /^https?:\/\/.+\..+/.test(u));
        };

        // 3️⃣ Group URLs by prompt_id
        const promptMap: Record<
          string,
          { promptText: string; urls: string[]; responses: PromptResponse[] }
        > = {};

        responses.forEach(resp => {
          const urls = extractUrlsFromResponse(resp);
          if (!promptMap[resp.prompt_id]) {
            promptMap[resp.prompt_id] = {
              promptText: resp.prompt_id, // fallback, can join with user_prompts for actual text
              urls: [],
              responses: [],
            };
          }
          const promptEntry = promptMap[resp.prompt_id];
          promptEntry?.urls.push(...urls);
          promptEntry?.responses.push(resp);
        });

        // 4️⃣ Flatten all URLs for sentiment analysis
        const allSources: SourceItem[] = Object.values(promptMap).flatMap(p =>
          p.urls.map(url => ({
            url,
            model: "", // optional: pick model from first resp if needed
            snippet: p.responses[0]?.response || "",
            title:
              p.responses[0]?.sources?.find(s => s.url === url)?.title ||
              p.responses[0]?.citations?.find(c => c.url === url)?.title ||
              "",
          }))
        );

        // 5️⃣ Calculate sentiment
        const sentimentResults = await calculateSentiment(allSources);

        // 6️⃣ Map sentiment back to each prompt and average
        const promptsWithSentiment = Object.entries(promptMap).map(([promptId, p]) => {
          const urlSentiments = p.urls.map(
            url => sentimentResults.find(s => s.url === url)?.sentiment ?? 50
          );
          const avgSentiment =
            urlSentiments.length > 0
              ? Math.round(urlSentiments.reduce((a, b) => a + b, 0) / urlSentiments.length)
              : 50;

          return {
            promptId,
            prompt: p.promptText,
            sentiment: avgSentiment,
            numResponses: p.responses.length,
          };
        });

        // 7️⃣ Update user_prompts table with sentiment
        await Promise.all(
          promptsWithSentiment.map(p =>
            clickhouse.query({
              query: `
                ALTER TABLE analytics.user_prompts UPDATE sentiment = ${p.sentiment}
                WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}' AND id = '${p.promptId}'
              `,
            })
          )
        );

        return { success: true, prompts: promptsWithSentiment };
      } catch (err) {
        console.error("Failed to fetch prompt sentiments:", err);
        return { success: false, prompts: [] };
      }
    }),
});