import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Perplexity from '@perplexity-ai/perplexity_ai';
import type { UserPrompt } from "@/server/db/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const perplexity = new Perplexity({ apiKey: process.env.PERPLEXITY_API_KEY! });

export interface WorkspaceLocation {
  workspaceCountry: string;
  workspaceRegion?: string | null;
}

export async function runLLMs(prompts: UserPrompt[], workspaceLocation?: WorkspaceLocation) {
  try {
    const allResults = await Promise.all( 
      prompts.map(async (promptObj) => {
        const { id, prompt } = promptObj;

        const [gptRes, claudeRes, perplexityRes] = await Promise.all([
          queryOpenAI(prompt, workspaceLocation),
          queryClaude(prompt, workspaceLocation),
          queryPerplexity(prompt, workspaceLocation),
        ]);

        return {
          id,
          results: [
            { modelProvider: "OpenAI", output: gptRes },
            { modelProvider: "Anthropic", output: claudeRes },
            { modelProvider: "Perplexity", output: perplexityRes },
          ],
        };
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

export async function queryOpenAI(userQuery: string, workspaceLocation?: WorkspaceLocation) {
  const response = await openai.responses.create({
    model: "o4-mini",
    tools: [
      {
        type: "web_search",
        user_location: {
          type: "approximate",
          country: workspaceLocation?.workspaceCountry,
          region: workspaceLocation?.workspaceRegion ?? undefined,
        }
      }
    ],
    input: userQuery,
  });
  
  // Extract all message-type outputs
  const messages = response.output.filter((o: any) => o.type === "message");

  // Extract all web_search outputs
  const allSources = response.output
    .filter((o: any) => o.type === "web_search")
    .flatMap((o: any) =>
      o.content?.map((s: any) => ({
        url: s.url,
        title: s.title ?? "",
      })) || []
    );

  // Build metrics: one metric per message, each with all sources
  const metrics = messages.flatMap((m: any) =>
    (m.content || []).map((c: any) => ({
      id: response.id,
      response: c.text || "",
      citations: Array.isArray(c.annotations)
        ? c.annotations.map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            start_index: r.start_index ?? null,
            end_index: r.end_index ?? null,
          }))
        : [],
      sources: [], // attach web_search sources later
    }))
  );

  // If no message output, create a single metric placeholder
  if (metrics.length === 0) {
    metrics.push({
      id: response.id,
      response: response.output_text || "",
      citations: [],
      sources: allSources,
    });
  }

  return {
    model: "o4-mini",
    metrics,
  };
}

export async function queryClaude(userQuery: string, workspaceLocation?: WorkspaceLocation) {
  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: userQuery
      }
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
        user_location: {
          type: "approximate",
          region: workspaceLocation?.workspaceRegion ?? undefined,
          country: workspaceLocation?.workspaceCountry,
        }
      }
    ]
  });

  if (!Array.isArray(response.content)) {
    return { model: "claude-3-5-haiku-latest", metrics: [], rawResponse: response };
  }

  const metrics = response.content.flatMap((item: any) => {
    if (item.type === "text" && Array.isArray(item.citations) && item.citations.length > 0) {
      return {
        id: response.id,
        response: item.text || "",
        citations: item.citations.map((r: any) => ({
          title: r.title || "",
          cited_text: r.cited_text || "",
          url: r.url || "",
        })),
        sources: [] as any[]
      };
    } else if (item.type === "web_search_tool_result" && Array.isArray(item.content)) {
      return {
        id: response.id,
        response: "",
        citations: [] as any[],
        sources: item.content.map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          page_age: r.page_age || null
        }))
      };
    }
    return [];
  });

  return {
    model: "claude-3-5-haiku-latest",
    metrics
  };
}

export async function queryPerplexity(userQuery: string, workspaceLocation?: WorkspaceLocation) {
  const response = await perplexity.chat.completions.create({
    model: "sonar",
    messages: [
      { role: "system", content: "Be precise and concise." },
      { role: "user", content: userQuery },
    ],
    web_search_options: {
      user_location: {
        country: workspaceLocation?.workspaceCountry,
        region: workspaceLocation?.workspaceRegion ?? undefined
      }
    }
  } as any);
  
  const answerText = response.choices?.[0]?.message?.content ?? "No response from Perplexity.";

  const searchResults = Array.isArray(response?.search_results)
    ? response.search_results
    : [];

  const sources = searchResults.map((result: any) => ({
    title: result.title ?? "",
    url: result.url ?? "",
    date: result.date ?? null,
  }));

  return {
    model: "Perplexity",
    metrics: [
      {
        id: "1",
        response: answerText,
        citations: [],
        sources,
      },
    ],
  };
}

export async function analyzeResponse(promptResponses: { modelProvider: string; response: string }[]) {
  // 🧠 Combine all model responses into a single structured input
  const combinedResponses = promptResponses.map((r) => ({
    model: r.modelProvider,
    response: r.response,
  }));

  const enhancedQuery = `
    You are an expert **market and brand intelligence analyst**.

    You are given an array of JSON objects. Each object has the following structure:
    {
      "model": "<ModelName>",
      "response": "<Full text response from that model>"
    }

    Your job is to analyze *each object* and return a **new JSON array** of the same shape, but with one additional field:
    1. "brandMetrics" — a JSON object containing all brand, company, or product mentions extracted from that model's response, following strict rules below.

    ---

    Brand & Mention Metrics Extraction
    After analyzing each model, extract **every identifiable brand, company, or product** mentioned *within that model’s text only*.

    brandMetrics rules:
    - Identify **every brand, company, or product** mentioned in your response — not just one or two examples.
    - Include the brand's official website (for favicons).
    - Dynamically infer numeric values based on context and frequency — **never use placeholders, default numbers, or generic text**.
    - Include the **brand’s official website domain** (for favicons and linking).
    - Include the **number of times (mentions)** the brand appears.
    - All numeric values must be **relative and contextual** to the content — ensure sentiment, visibility, and position are consistent with the AI response’s tone and structure.

    Where:
      - **mentions** = number of times the brand appears in the response
      - **sentiment** = inferred tone or favorability toward the brand, calculated from your *response text*, interpreted *in the context of the user’s query*. (Range: 0 = very negative, 100 = very positive)
      - **visibility** = relative prominence of the brand based on how frequently and prominently it appears in your *response text* compared to other brands. (Range: 0–100)
      - **position** = normalized relative position of the brand in your response compared to all other mentioned brands. (Range: 0–1, where 0 = earliest mentioned, 1 = last mentioned)
      - **website** = official website URL of the brand (to generate favicons)

    BRAND NORMALIZATION

    - If a brand’s **product or sub-brand** (e.g., “Freshsales” by “Freshworks”) appears, merge it under the **parent or main brand name** unless the context clearly treats them as separate brands.  
    - Always use the **canonical parent brand** as the JSON key.
    - Do not include both brand and product names separately unless they are distinctly recognized brands (e.g., “Apple” and “Beats”).
    - Combine metrics of duplicates (e.g., merge “Freshsales” metrics into “Freshworks”).

    CROSS-MODEL BRAND CONSISTENCY

    - Maintain **consistent brand naming across all models** in this batch.  
      Example:
        - If one model mentions “HubSpot CRM” and another mentions “HubSpot,” treat both as **“HubSpot”**.  
    - Use the **most canonical, widely recognized brand name** when standardizing (e.g., prefer “HubSpot” over “HubSpot CRM”).
    - Ensure that brand names are identical across all array entries for the same underlying brand.

    **Rules**
    - Include all mentioned brands — no omissions.
    - Use dynamic, context-based numeric values only.
    - Never invent nonexistent brands.
    - JSON must be valid, parsable, and appear immediately after that model’s analysis.
    - IMPORTANT: Do not include markdown code fences or any extra text after JSON blocks.

    ---

    ### OUTPUT FORMAT

    Return a valid JSON array (no markdown, no text outside JSON).

    Each array element must look exactly like this:
    {
      "model": "<ModelName>",
      "response": "<OriginalResponse>",
      "brandMetrics": {
        "<Brand1>": {
          "mentions": <number>,
          "sentiment": <number>,
          "visibility": <number>,
          "position": <number>,
          "website": "<url>"
        },
        "<Brand2>": { ... },
        ....
      }
    }

    ---

    ### INPUT JSON

    ${JSON.stringify(combinedResponses, null, 2)}

    Analyze this JSON and return the enhanced version **as valid JSON only**.
    `;

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