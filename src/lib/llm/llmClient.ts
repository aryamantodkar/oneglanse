import type { UserPrompt, WorkspaceLocation } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { safeCall } from "../helper/functions";
import { queryClaude } from "./models/anthropic";
import { queryOpenAI } from "./models/openAI";
import { queryPerplexity } from "./models/perplexity";

export async function runLLMs(prompts: UserPrompt[], workspaceLocation?: WorkspaceLocation) {
  try {
    const allResults = await Promise.all( 
      prompts.map(async (promptObj) => {
        const { id, prompt } = promptObj;

        const [gptRes, claudeRes, perplexityRes] = await Promise.all([
          safeCall(() => queryOpenAI(prompt, workspaceLocation), "OpenAI"),
          safeCall(() => queryClaude(prompt, workspaceLocation), "Claude"),
          safeCall(() => queryPerplexity(prompt, workspaceLocation), "Perplexity"),
        ]);

        const results = [
          {
            modelProvider: "OpenAI",
            output: gptRes.success ? gptRes.data : { error: gptRes.error },
          },
          {
            modelProvider: "Anthropic",
            output: claudeRes.success ? claudeRes.data : { error: claudeRes.error },
          },
          {
            modelProvider: "Perplexity",
            output: perplexityRes.success ? perplexityRes.data : { error: perplexityRes.error },
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