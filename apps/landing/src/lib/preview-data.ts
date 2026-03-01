import type {
  DashboardCompetitorData,
  DashboardSourceData,
} from "@oneglanse/ui";

export const PREVIEW_BRAND = {
  name: "OneGlanse",
  domain: "oneglanse.com",
} as const;

export const PREVIEW_COMPETITORS: DashboardCompetitorData[] = [
  {
    name: "OneGlanse",
    domain: "oneglanse.com",
    appearances: 92,
    visibility: 86,
    avgSentiment: 82,
    avgRank: 1.4,
    recCount: 74,
    winsOver: ["Profound", "Peec AI"],
    losesTo: [],
    isBrand: true,
  },
  {
    name: "Profound",
    domain: "tryprofound.com",
    appearances: 66,
    visibility: 64,
    avgSentiment: 73,
    avgRank: 2.6,
    recCount: 49,
    winsOver: ["Goodie"],
    losesTo: ["OneGlanse"],
  },
  {
    name: "Peec AI",
    domain: "peec.ai",
    appearances: 58,
    visibility: 55,
    avgSentiment: 69,
    avgRank: 3.1,
    recCount: 38,
    winsOver: ["Goodie"],
    losesTo: ["OneGlanse"],
  },
  {
    name: "Goodie",
    domain: "goodie.so",
    appearances: 44,
    visibility: 42,
    avgSentiment: 61,
    avgRank: 3.8,
    recCount: 26,
    winsOver: [],
    losesTo: ["OneGlanse", "Profound", "Peec AI"],
  },
  {
    name: "AthenaHQ",
    domain: "athenahq.ai",
    appearances: 31,
    visibility: 28,
    avgSentiment: 57,
    avgRank: 4.4,
    recCount: 19,
    winsOver: [],
    losesTo: ["OneGlanse"],
  },
];

export const PREVIEW_SOURCES: DashboardSourceData[] = [
  {
    domain: "github.com",
    favicon: null,
    citationCount: 48,
    uniqueRecords: new Set(["r1", "r2", "r3", "r4", "r5", "r6", "r7"]),
    models: new Set(["openai", "anthropic", "perplexity", "google"]),
  },
  {
    domain: "docs.oneglanse.com",
    favicon: null,
    citationCount: 39,
    uniqueRecords: new Set(["r1", "r3", "r4", "r8", "r9"]),
    models: new Set(["openai", "anthropic", "google"]),
  },
  {
    domain: "clickhouse.com",
    favicon: null,
    citationCount: 24,
    uniqueRecords: new Set(["r2", "r5", "r9", "r10"]),
    models: new Set(["perplexity", "google", "google-ai-overview"]),
  },
  {
    domain: "vercel.com",
    favicon: null,
    citationCount: 17,
    uniqueRecords: new Set(["r2", "r5", "r7"]),
    models: new Set(["openai", "anthropic"]),
  },
  {
    domain: "supabase.com",
    favicon: null,
    citationCount: 13,
    uniqueRecords: new Set(["r6", "r11"]),
    models: new Set(["openai", "google"]),
  },
];

export const PREVIEW_TOTAL_RESPONSES = 108;
export const PREVIEW_TOTAL_CITATIONS = 141;

export const PREVIEW_PERCEPTION = {
  bestKnownFor: "open-source AI visibility operations with citation-level tracking",
  pricingPerception: "mid_range",
  coreClaims: [
    "auditable llm visibility metrics",
    "provider-comparable ranking analysis",
    "source-level citation intelligence",
    "docker-first self-hosting",
  ],
  differentiators: [
    "clickhouse-native analytics",
    "workspace segmentation",
    "provider-specific prompt runs",
    "geo and sentiment tracking",
    "open architecture",
  ],
} as const;

export const PREVIEW_SOURCE_GROUPS = [
  {
    domain: "github.com",
    urls: 19,
    citations: 48,
    share: 34,
    providers: ["openai", "anthropic", "perplexity", "google"],
  },
  {
    domain: "docs.oneglanse.com",
    urls: 12,
    citations: 39,
    share: 27,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "clickhouse.com",
    urls: 8,
    citations: 24,
    share: 17,
    providers: ["perplexity", "google", "google-ai-overview"],
  },
] as const;

export const PREVIEW_HERO_METRICS = [
  { label: "Weekly Prompt Runs", value: "9,840", detail: "+22% over last month" },
  { label: "Provider Coverage", value: "5", detail: "OpenAI, Claude, Gemini, Perplexity, AI Overview" },
  { label: "Tracked Citations", value: "61K", detail: "Deduplicated by domain and model" },
] as const;
