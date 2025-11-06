import type { WorkspaceLocation } from '@/server/db/types';
import Perplexity from '@perplexity-ai/perplexity_ai';

const perplexity = new Perplexity({ apiKey: process.env.PERPLEXITY_API_KEY! });

export async function queryPerplexity(userQuery: string, workspaceLocation?: WorkspaceLocation) {
    try{
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
    catch(error: any){
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }