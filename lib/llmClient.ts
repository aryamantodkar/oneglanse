import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface Citation {
  url: string;
  snippet: string;
  sentiment: number;
  position: number;
}

export interface AggregateFields {
  avgSentiment: number;
  avgPosition: number;
  visibility: number;
}

export interface BrandAnalysis {
  name: string;
  reason: string;
  citations: Citation[];
  aggregate_fields: AggregateFields;
}

export interface AnalyzerOutput {
  model: string;
  brands: BrandAnalysis[];
}

export async function runLLMs(userQuery: string) {
  try {
    const [gptRes, claudeRes] = await Promise.all([
      queryOpenAI(userQuery),
      queryClaude(userQuery),
    ]);

    const combinedResults = [
      { source: "OpenAI GPT", output: gptRes },
      { source: "Anthropic Claude", output: claudeRes },
    ];

    const analysis = await analyzeWithLLM(combinedResults);

    return {
      analysis
    };
  } catch (err) {
    console.error("Error running LLMs or analyzing results:", err);
    return {
      analysis: { model: "gpt-5", brands: [] },
    };
  }
}
export async function queryOpenAI(userQuery: string) {
  const response = await openai.responses.create({
    model: "gpt-5",
    tools: [{ type: "web_search" }],
    input: userQuery,
  });

  // Extract all useful metrics from output
  const metrics = response.output.map((o: any) => ({
    output_id: o.id,
    type: o.type,
    status: o.status,
    action: o.action,          // e.g., web search query details
    content: o.content,        // e.g., assistant messages, text, citations
    annotations: o.annotations,// URL citations for brand mentions
    output_text: o.output_text // raw text if present
  }));

  return {
    model: "gpt-5",
    rawResponse: response, // full original response
    metrics,              // extracted useful metrics
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
    tools: [{
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5
    }]
  });

  // Extract useful metrics from Claude response
  const metrics = response.content.map((item: any) => {
    if (item.type === "text") {
      return {
        type: "assistant_text",
        content: item.text,
        citations: item.citations
      };
    } else if (item.type === "server_tool_use") {
      return {
        type: "tool_use",
        tool_name: item.name,
        tool_input: item.input
      };
    } else if (item.type === "web_search_tool_result") {
      return {
        type: "web_search_result",
        tool_use_id: item.tool_use_id,
        results: item.content.map((r: any) => ({
          title: r.title,
          url: r.url,
          page_age: r.page_age
        }))
      };
    }
    return { type: item.type, raw: item };
  });

  return {
    model: "claude-opus-4-1-20250805",
    rawResponse: response,
    metrics
  };
}

export async function analyzeWithLLM(rawResults: any[]): Promise<AnalyzerOutput> {
  const analysisPrompt = `
    You are an expert AI brand analyst. Analyze the following raw outputs from multiple AI models and extract **brand visibility and geo insights**.

    Raw Results:
    ${JSON.stringify(rawResults, null, 2)}

    Task (return **strict JSON only**):
    1. Identify at least 5 unique brands.
    2. For each brand, extract:
      - name: brand name
      - reason: 3-4 sentences explanation.
      - citations: array of objects:
          {
            url: string,       // actual URL if known, else platform/publication
            snippet: string,   // text mentioning the brand
            sentiment: number, // 0-100 numeric
            position: number   // decimal, 1.0 = most prominent
          }
      - aggregate_fields:
          {
            avgSentiment: number,  // average sentiment
            avgPosition: number,   // average position
            visibility: number     // % of total citations for this brand
          }
    3. Optional: if any geo-specific mentions exist, include a 'geo' field per brand with regional insights.

    Rules:
    - Do NOT hallucinate URLs. Use platform/publication if unknown.
    - Sentiment and position must be numeric.
    - Sentiment must be numeric 0-100.
    - Position can be fractional.
    - Output valid JSON only.
    - Include **all citations** found for each brand.
`;

  const res = await openai.responses.create({
    model: "gpt-5",
    input: analysisPrompt,
  });

  const text = res.output_text.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    const parsed: AnalyzerOutput = JSON.parse(text);

    // Ensure all numeric fields are valid
    const allCitations = parsed.brands.flatMap(b => b.citations || []);
    const totalCitations = allCitations.length || 1;

    parsed.brands = parsed.brands.map(b => {
      const citations = (b.citations || []).map(c => ({
        ...c,
        sentiment: Number(c.sentiment) || 0,
        position: Number(c.position) || 0,
      }));

      const avgSentiment =
        citations.reduce((sum, c) => sum + c.sentiment, 0) / Math.max(citations.length, 1);
      const avgPosition =
        citations.reduce((sum, c) => sum + c.position, 0) / Math.max(citations.length, 1);
      const visibility = Math.round((citations.length / totalCitations) * 100);

      return {
        ...b,
        citations,
        aggregate_fields: {
          avgSentiment: Math.round(avgSentiment),
          avgPosition: Number(avgPosition.toFixed(2)),
          visibility,
        },
      };
    });

    parsed.brands.sort(
      (a, b) => (b.aggregate_fields.visibility ?? 0) - (a.aggregate_fields.visibility ?? 0)
    );

    return parsed;
  } catch (err) {
    console.error("Failed to parse analyzer output:", err, text);
    return { model: "gpt-5", brands: [] };
  }
}