import { openai } from "@/lib/apiKeys";
import type { WorkspaceLocation } from "@/server/db/types";

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