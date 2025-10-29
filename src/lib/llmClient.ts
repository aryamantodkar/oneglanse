import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Perplexity from '@perplexity-ai/perplexity_ai';
import type { UserPrompt } from "@/server/db/types";
import fs from "fs";
import path from "path";

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
            { modelProvider: "OpenAI GPT", output: gptRes },
            { modelProvider: "Anthropic Claude", output: claudeRes },
            { modelProvider: "Perplexity", output: perplexityRes },
          ],
        };
      })
    );
    const logPath = path.resolve("llm_results.json");
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