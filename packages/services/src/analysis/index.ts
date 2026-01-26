import { analysisPrompt } from "./analysisPrompt";
import { ExternalServiceError, safeHandler, ValidationError } from "@onescope/errors";
import type { AnalysisInput, AnalysisOutput } from "@onescope/types";
import fs from "fs";
import path from "path";
import { getOpenai } from "../llm";

export async function runAnalysis(analysisData: AnalysisInput) {
    const openai = getOpenai();
    
    return safeHandler(async () => {  
      const enhancedQuery = analysisPrompt(analysisData);
  
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
          { enhancedQuery, promptCount: analysisData.length },
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
    
      return parsed as AnalysisOutput;
    })
  }