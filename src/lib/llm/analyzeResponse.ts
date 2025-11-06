import { fixedWindowLimiter } from "@/server/redis/limiter/fixedWindowLimiter";
import OpenAI from "openai";
import { analyzeQuery } from "./queries/analyzeQuery";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const OPENAI_LIMIT = { limit: 60, windowSec: 60 };

export async function analyzeResponse(promptResponses: { modelProvider: string; response: string }[]) {
    const vendorKey = `vendor:openai:o4-mini`;
    const { allowed, remaining } = await fixedWindowLimiter(vendorKey, OPENAI_LIMIT.limit, OPENAI_LIMIT.windowSec);

    if (!allowed) {
      // Option A: throw immediately and signal client to retry later
      const err: any = new Error("OpenAI capacity reached. Try again later.");
      err.code = "VENDOR_RATE_LIMIT";
      throw err;
  
      // Option B (recommended at scale): enqueue job to process later (see section "Queue pattern")
    }

    const combinedResponses = promptResponses.map((r) => ({
      model: r.modelProvider,
      response: r.response,
    }));

    const enhancedQuery = analyzeQuery(combinedResponses);

    const response = await openai.responses.create({
      model: "o4-mini",
      input: enhancedQuery,
    });
  
    const text = response.output_text?.trim() || "";
  
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error("❌ Failed to parse LLM JSON output:", error);
      console.error("Raw LLM output:", text);
      throw new Error("Invalid JSON returned from LLM");
    }
  
    const results: Record<
      string,
      { brandMetrics: any }
    > = {};
  
    for (const item of parsed) {
      if (item?.model) {
        results[item.model.trim().toLowerCase()] = {
          brandMetrics: item.brandMetrics ?? {},
        };
      }
    }
  
    return results;
  }