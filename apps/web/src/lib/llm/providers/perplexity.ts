import { perplexity } from '@/lib/llm/apiKeys';
import type { WorkspaceLocation } from '@/server/db/types';
import systemPrompt from "../systemPrompt";

export async function queryPerplexity(userQuery: string, workspaceLocation?: WorkspaceLocation) {
    const response = await perplexity.chat.completions.create({
      model: "sonar-pro",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
      web_search_options: {
        user_location: {
          country: workspaceLocation?.workspaceCountry ?? "US",
          region: workspaceLocation?.workspaceRegion?.trim() || undefined
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