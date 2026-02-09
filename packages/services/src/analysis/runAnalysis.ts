import { analysisPrompt } from "./analysisPrompt.js";
import { ExternalServiceError, safeHandler, ValidationError } from "@onescope/errors";
import type { AnalysisInputSingle, LLMBrandAnalysis } from "@onescope/types";
import { openai } from "../llm/index.js";

export async function runAnalysis(input: AnalysisInputSingle) {
    return safeHandler(async () => {
      const prompt = analysisPrompt(input);

      let response;
      try {
        response = await openai.responses.create({
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: "You are a brand intelligence extraction engine. Return only valid JSON matching the requested schema. Do not include any markdown formatting or explanation."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          text: {
            format: { type: "json_object" }
          }
        });
      } catch (err) {
        throw new ExternalServiceError(
          "OpenAI",
          "Failed to analyze response.",
          502,
          { responseLength: input.response.length, sourcesCount: input.sources.length },
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

      return parsed as LLMBrandAnalysis;
    })
  }