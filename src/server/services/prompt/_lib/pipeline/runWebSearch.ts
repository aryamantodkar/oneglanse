import type { UserPrompt, WorkspaceLocation } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { ExternalServiceError, safeHandler } from "@/server/error";
import { queryClaude } from "@/lib/llm/providers/anthropic";
import { queryOpenAI } from "@/lib/llm/providers/openAI";
import { queryPerplexity } from "@/lib/llm/providers/perplexity";

export async function runWebSearch(prompts: UserPrompt[], workspaceLocation?: WorkspaceLocation) {
  try {
    const prompt_run_at = new Date();

    const allResults = await Promise.all( 
      prompts.map(async (promptObj) => {
        const { id, prompt } = promptObj;

        const [gptRes, claudeRes, perplexityRes] = await Promise.all([
          safeHandler(async () => {
            try {
              return await queryOpenAI(prompt, workspaceLocation);
            } catch (err) {
              throw new ExternalServiceError("OpenAI", "OpenAI request failed.", 502, { prompt });
            }
          }),
          safeHandler(async () => {
            try{
              return await queryClaude(prompt, workspaceLocation)
            }
            catch(err){
              throw new ExternalServiceError("Anthropic", "Anthropic request failed.", 502, { prompt });
            }
          }),
          safeHandler(async () => {
            try{
              return await queryPerplexity(prompt, workspaceLocation)
            }
            catch(err){
              throw new ExternalServiceError("Anthropic", "Anthropic request failed.", 502, { prompt });
            }
          }),
        ]);

        const results = [
          {
            model_provider: "OpenAI",
            output: gptRes.data,
          },
          {
            model_provider: "Anthropic",
            output: claudeRes.data,
          },
          {
            model_provider: "Perplexity",
            output: perplexityRes.data,
          },
        ];

        return { id, prompt_run_at, results };
      })
    );
    

    const logPath = path.join(
      process.cwd(),
      "mockData",
      "llm_results.json"
    );
      
    fs.writeFileSync(logPath, JSON.stringify(allResults, null, 2));

    console.log("All LLM results:", JSON.stringify(allResults, null, 2));
    console.log(`✅ All LLM results written to: ${logPath}`);

    return allResults;
  } catch (err) {
    console.error("Error running LLMs or analyzing results:", err);
    return [];
  }
}