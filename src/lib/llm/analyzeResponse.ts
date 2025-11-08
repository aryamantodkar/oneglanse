import OpenAI from "openai";
import { analyzeQuery } from "./queries/analyzeQuery";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyzeResponse(promptResponses: { modelProvider: string; response: string }[]) {
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