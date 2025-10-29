import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { clickhouse, db } from "@/server/db/index";
import { eq } from "drizzle-orm";
import { brands } from "@/server/db/schema/brand";
import type { PromptResponse } from "@/server/db/types";

export const analysisRouter = createTRPCRouter({
  analyzeMetrics: protectedProcedure
  .input(z.object({ workspaceId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const { workspaceId } = input;
    const userId = ctx.session?.user.id;
    if (!userId) throw new Error("Unauthorized");

    try {
      // 1️⃣ Fetch all prompt responses
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

      // 2️⃣ Group responses by prompt_id
      const promptMap: Record<string, { promptText: string; responses: PromptResponse[] }> = {};
      responses.forEach((resp) => {
        if (!promptMap[resp.prompt_id])
          promptMap[resp.prompt_id] = { promptText: resp.prompt_id, responses: [] };
        promptMap[resp.prompt_id]?.responses.push(resp);
      });

      // 3️⃣ Extract BRAND_METRICS from LLM response
      const promptsWithMetrics = Object.entries(promptMap).map(([promptId, p]) => {
        const perModel: Record<
          string,
          {
            topFavicons: string[];
            brandMetrics?: Record<
              string,
              { sentiment: number; visibility: number; position: number }
            >;
          }
        > = {};
      
        p.responses.forEach((resp) => {
          const model = resp.model ?? "unknown";
          if (!perModel[model])
            perModel[model] = { topFavicons: [], brandMetrics: {} };
      
          const m = perModel[model];
          const text = resp.response || "";
      
          // Extract BRAND_METRICS JSON from response
          const brandMetricsMatch = text.match(/BRAND_METRICS:\s*(\{[\s\S]*\})/);
          if (brandMetricsMatch && brandMetricsMatch[1]) {
            try {
              const metricsJson: Record<string, { sentiment: number; visibility: number; position: number }> = JSON.parse(brandMetricsMatch[1]);
      
              // --- Convert normalized position 0–1 to ranks ---
              const sortedBrands = Object.entries(metricsJson)
                .sort(([, a], [, b]) => a.position - b.position)
                .map(([name], index) => ({ name, rank: index + 1 }));
      
              // Top 4 favicons for model
              m.topFavicons = sortedBrands
                .slice(0, 4)
                .map(({ name }) => `https://www.google.com/s2/favicons?sz=32&domain_url=${name.replace(/\s+/g, "").toLowerCase()}.com`);
      
              // Store individual brand metrics
              Object.entries(metricsJson).forEach(([brandName, metric], i) => {
                m.brandMetrics![brandName] = {
                  sentiment: metric.sentiment,
                  visibility: metric.visibility,
                  position: sortedBrands.find((b) => b.name === brandName)?.rank || i + 1,
                };
              });
      
              // Optional: average model-level metrics
              const brandValues = Object.values(m.brandMetrics!);
            } catch (e) {
              console.warn("Failed to parse BRAND_METRICS JSON:", e);
            }
          }
        });
      
        return {
          promptId,
          prompt: p.promptText,
          per_model: perModel,
        };
      });

      console.log("Prompt with metrics", JSON.stringify(promptsWithMetrics,null,2));

      // 4️⃣ Update user_prompts table
      await Promise.all(
        promptsWithMetrics.map((p) =>
          clickhouse.query({
            query: `
              ALTER TABLE analytics.user_prompts UPDATE
                per_model = '${JSON.stringify(p.per_model)}'
              WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}' AND id = '${p.promptId}'
            `,
          })
        )
      );

      return { success: true, prompts: promptsWithMetrics };
    } catch (err) {
      console.error("Failed to analyze metrics:", err);
      return { success: false, prompts: [] };
    }
  }),
});

