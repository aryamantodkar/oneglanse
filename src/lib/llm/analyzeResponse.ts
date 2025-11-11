import OpenAI from "openai";
import { analyzeQuery } from "./queries/analyzeQuery";
import { ExternalServiceError, safeHandler, ValidationError } from "@/server/error";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyzeResponse(promptResponses: { modelProvider: string; response: string }[]) {
    return safeHandler(async () => {
      const combinedResponses = promptResponses.map((r) => ({
        model: r.modelProvider,
        response: r.response,
      }));
  
      const enhancedQuery = analyzeQuery(combinedResponses);
  
      let response;
      try {
        response = await openai.responses.create({
          model: "o4-mini",
          input: enhancedQuery,
        });
      } catch (err) {
        throw new ExternalServiceError(
          "OpenAI",
          "Failed to analyze responses.",
          502,
          { enhancedQuery, promptCount: promptResponses.length },
          err
        );
      }
    
      const text = response.output_text?.trim() || "";
    
      let parsed: any[] = [];
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new ValidationError(
          "Invalid JSON returned from LLM during analysis.",
          { rawOutput: text.slice(0, 200) }
        );
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
    })
  }