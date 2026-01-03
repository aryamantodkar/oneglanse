import "server-only";

import OpenAI from "openai";
import { ExternalServiceError, safeHandler, ValidationError } from "@/server/error";
import { competitorsPrompt } from "./competitorsPrompt";
import type { CompetitorInput, CompetitorsResponse } from "@/server/db/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyseCompetitors(brandData : CompetitorInput) {
    return safeHandler(async () => {  
      const enhancedQuery = competitorsPrompt(brandData);
  
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
          { enhancedQuery, brandData },
          err
        );
      }
    
      const text = response.output_text?.trim() || "";
    
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new ValidationError(
          "Invalid JSON returned from LLM during analysis.",
          { rawOutput: text.slice(0, 200) }
        );
      }

      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid JSON shape");
      }
    
      return parsed as CompetitorsResponse;
    })
  }