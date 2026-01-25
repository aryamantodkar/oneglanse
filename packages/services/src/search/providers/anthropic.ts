import { anthropic } from "../../llm";
import type { WorkspaceLocation } from "@onescope/types";
import systemPrompt from "../systemPrompt";

export async function queryClaude(userQuery: string, workspaceLocation?: WorkspaceLocation) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userQuery,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          user_location: {
            type: "approximate",
            country: workspaceLocation?.workspaceCountry ?? "US",
            region: workspaceLocation?.workspaceRegion?.trim() || undefined
          },
        },
      ],
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
  