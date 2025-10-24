import axios from "axios";
import * as cheerio from "cheerio";
import Sentiment from "sentiment";

export interface SourceItem {
  url: string;
  title?: string;
  model: string;
  snippet?: string; // optional snippet from LLM
}

export interface SentimentResult {
  url: string;
  domain: string;
  model: string;
  sentiment: number; // 0 to 100
  snippet?: string;
}

export async function calculateSentiment(sources: SourceItem[]): Promise<SentimentResult[]> {
  const sentimentAnalyzer = new Sentiment();
  const results: SentimentResult[] = [];

  for (const source of sources) {
    try {
      const domain = new URL(source.url).hostname;

      // Scrape page content
      const { data } = await axios.get(source.url, {
        timeout: 15000,
        maxRedirects: 3,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        validateStatus: (status) => status < 400,
      });
      
      const $ = cheerio.load(data);
      const text = $("p").map((_, el) => $(el).text()).get().join(" ");

      // Compute sentiment and normalize to 0-100
      const rawScore = sentimentAnalyzer.analyze(text).comparative;
      const score = Math.round(((rawScore + 1) / 2) * 100);

      results.push({
        url: source.url,
        domain,
        model: source.model,
        sentiment: score,
        snippet: source.snippet,
      });
    } catch (err) {
      console.error(`Failed to process ${source.url}`, err);

      results.push({
        url: source.url,
        domain: source.url.split("/")[2] || "",
        model: source.model,
        sentiment: 50, // neutral fallback in 0-100
        snippet: source.snippet,
      });
    }
  }

  return results;
}