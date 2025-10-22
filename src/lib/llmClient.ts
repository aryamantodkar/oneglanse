import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type UserPrompt = {
  id: string;
  user_id: string;
  workspace_id: string;
  prompt: string;
  created_at: string;
};

export interface WorkspaceLocation {
  workspaceCountry: string;
  workspaceRegion?: string | null;
}

export async function runLLMs(prompts: UserPrompt[], workspaceLocation?: WorkspaceLocation) {
  try {
    const allResults = await Promise.all( 
      prompts.map(async (promptObj) => {
        const { id, prompt } = promptObj;

        const [gptRes] = await Promise.all([
          queryOpenAI(prompt, workspaceLocation),
          // queryClaude(prompt),
        ]);

        return {
          id,
          results: [
            { modelProvider: "OpenAI GPT", output: gptRes },
            // { modelProvider: "Anthropic Claude", output: claudeRes },
          ],
        };
      })
    );
    
    console.log("All LLM results:", JSON.stringify(allResults, null, 2));

    return allResults;
  } catch (err) {
    console.error("Error running LLMs or analyzing results:", err);
    return [];
  }
}

export async function queryOpenAI(userQuery: string, workspaceLocation?: WorkspaceLocation) {
  const tools: any[] = [
    {
      type: "web_search",
      ...(workspaceLocation && workspaceLocation.workspaceCountry !== "GLOBAL"
        ? {
            user_location: {
              type: "approximate",
              country: workspaceLocation.workspaceCountry,
              region: workspaceLocation.workspaceRegion ?? undefined,
            },
          }
        : {}),
    },
  ];

  const response = await openai.responses.create({
    model: "gpt-5",
    tools,
    input: userQuery,
  });

  console.log("OpenAI response:", JSON.stringify(response, null, 2));
  
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
    model: "gpt-5",
    metrics,
  };
}

export async function queryClaude(userQuery: string) {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-1-20250805",
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
        max_uses: 5
      }
    ]
  });

  if (!Array.isArray(response.content)) {
    return { model: "claude-opus-4-1-20250805", metrics: [], rawResponse: response };
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
    model: "claude-opus-4-1-20250805",
    metrics
  };
}