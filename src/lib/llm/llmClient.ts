import type { UserPrompt, WorkspaceLocation } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { queryClaude } from "./models/anthropic";
import { queryOpenAI } from "./models/openAI";
import { queryPerplexity } from "./models/perplexity";
import { safeHandler } from "../error/errorHandling";
import { ExternalServiceError } from "@/lib/error";

export async function runLLMs(prompts: UserPrompt[], workspaceLocation?: WorkspaceLocation) {
  try {
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
            modelProvider: "OpenAI",
            output: gptRes.data,
          },
          {
            modelProvider: "Anthropic",
            output: claudeRes.data,
          },
          {
            modelProvider: "Perplexity",
            output: perplexityRes.data,
          },
        ];

        return { id, results };
      })
    );
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const logPath = path.join(__dirname, "..", "mockData", "llm_results.json");
      
    fs.writeFileSync(logPath, JSON.stringify(allResults, null, 2));

    console.log("All LLM results:", JSON.stringify(allResults, null, 2));
    console.log(`✅ All LLM results written to: ${logPath}`);

    return allResults;
  } catch (err) {
    console.error("Error running LLMs or analyzing results:", err);
    return [];
  }
}