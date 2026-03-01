import type {
  DashboardCompetitorData,
  DashboardSourceData,
} from "@oneglanse/ui";

export const PREVIEW_BRAND = {
  name: "HubSpot",
  domain: "hubspot.com",
} as const;

export const PREVIEW_COMPETITORS: DashboardCompetitorData[] = [
  {
    name: "HubSpot",
    domain: "hubspot.com",
    appearances: 221,
    visibility: 84,
    avgSentiment: 81,
    avgRank: 1.6,
    recCount: 173,
    winsOver: ["Salesforce", "Marketo", "Mailchimp"],
    losesTo: [],
    isBrand: true,
  },
  {
    name: "Salesforce",
    domain: "salesforce.com",
    appearances: 178,
    visibility: 72,
    avgSentiment: 74,
    avgRank: 2.3,
    recCount: 126,
    winsOver: ["Marketo", "Pardot"],
    losesTo: ["HubSpot"],
  },
  {
    name: "Marketo",
    domain: "adobe.com/products/marketo",
    appearances: 141,
    visibility: 59,
    avgSentiment: 67,
    avgRank: 3,
    recCount: 88,
    winsOver: ["Mailchimp"],
    losesTo: ["HubSpot", "Salesforce"],
  },
  {
    name: "Mailchimp",
    domain: "mailchimp.com",
    appearances: 114,
    visibility: 47,
    avgSentiment: 63,
    avgRank: 3.7,
    recCount: 68,
    winsOver: ["ActiveCampaign"],
    losesTo: ["HubSpot", "Salesforce"],
  },
  {
    name: "ActiveCampaign",
    domain: "activecampaign.com",
    appearances: 91,
    visibility: 36,
    avgSentiment: 58,
    avgRank: 4.2,
    recCount: 43,
    winsOver: [],
    losesTo: ["HubSpot", "Salesforce", "Marketo"],
  },
  {
    name: "Pardot",
    domain: "salesforce.com/products/marketing-cloud/account-engagement",
    appearances: 68,
    visibility: 29,
    avgSentiment: 54,
    avgRank: 4.9,
    recCount: 30,
    winsOver: [],
    losesTo: ["HubSpot", "Salesforce"],
  },
];

export const PREVIEW_SOURCES: DashboardSourceData[] = [
  {
    domain: "hubspot.com",
    favicon: null,
    citationCount: 142,
    uniqueRecords: new Set(["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]),
    models: new Set(["openai", "anthropic", "google", "perplexity"]),
  },
  {
    domain: "g2.com",
    favicon: null,
    citationCount: 121,
    uniqueRecords: new Set(["r2", "r4", "r5", "r9", "r10", "r11"]),
    models: new Set(["openai", "anthropic", "google"]),
  },
  {
    domain: "capterra.com",
    favicon: null,
    citationCount: 102,
    uniqueRecords: new Set(["r3", "r5", "r8", "r12", "r13"]),
    models: new Set(["openai", "perplexity", "google-ai-overview"]),
  },
  {
    domain: "salesforce.com",
    favicon: null,
    citationCount: 89,
    uniqueRecords: new Set(["r1", "r6", "r7", "r14", "r15"]),
    models: new Set(["openai", "anthropic", "perplexity"]),
  },
  {
    domain: "forrester.com",
    favicon: null,
    citationCount: 74,
    uniqueRecords: new Set(["r6", "r12", "r16", "r17"]),
    models: new Set(["openai", "google", "perplexity"]),
  },
  {
    domain: "gartner.com",
    favicon: null,
    citationCount: 66,
    uniqueRecords: new Set(["r9", "r10", "r18", "r19"]),
    models: new Set(["anthropic", "google", "google-ai-overview"]),
  },
];

export const PREVIEW_TOTAL_RESPONSES = 264;
export const PREVIEW_TOTAL_CITATIONS = 912;

export const PREVIEW_PERCEPTION = {
  bestKnownFor: "unified CRM and marketing automation for scaling revenue teams",
  pricingPerception: "premium",
  coreClaims: [
    "all-in-one crm plus marketing hub",
    "strong onboarding and ecosystem fit",
    "high-quality reporting and attribution",
    "enterprise-ready automation workflows",
  ],
  differentiators: [
    "integrated sales-marketing-service data model",
    "large app marketplace",
    "strong b2b content tooling",
    "mature partner ecosystem",
    "multi-hub architecture",
  ],
} as const;

export const PREVIEW_ALT_PERCEPTION = {
  bestKnownFor: "ease of use without sacrificing operational depth",
  pricingPerception: "mid_range",
  coreClaims: [
    "fast campaign orchestration",
    "cross-channel execution from one platform",
    "reliable lead lifecycle automation",
    "strong fit for mid-market teams",
  ],
  differentiators: [
    "workflow builder",
    "contact-level personalization",
    "native analytics",
    "customer journey visibility",
  ],
} as const;

export const PREVIEW_SOURCE_GROUPS = [
  {
    domain: "hubspot.com",
    urls: 42,
    citations: 142,
    share: 15.6,
    providers: ["openai", "anthropic", "perplexity", "google"],
  },
  {
    domain: "g2.com",
    urls: 33,
    citations: 121,
    share: 13.3,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "capterra.com",
    urls: 31,
    citations: 102,
    share: 11.2,
    providers: ["openai", "perplexity", "google-ai-overview"],
  },
  {
    domain: "salesforce.com",
    urls: 26,
    citations: 89,
    share: 9.8,
    providers: ["openai", "anthropic", "perplexity"],
  },
  {
    domain: "forrester.com",
    urls: 21,
    citations: 74,
    share: 8.1,
    providers: ["openai", "google", "perplexity"],
  },
  {
    domain: "gartner.com",
    urls: 18,
    citations: 66,
    share: 7.2,
    providers: ["anthropic", "google", "google-ai-overview"],
  },
  {
    domain: "mailchimp.com",
    urls: 16,
    citations: 51,
    share: 5.6,
    providers: ["openai", "anthropic"],
  },
  {
    domain: "adobe.com",
    urls: 14,
    citations: 44,
    share: 4.8,
    providers: ["openai", "perplexity"],
  },
] as const;

export const PREVIEW_CITATION_ROWS = [
  {
    domain: "g2.com",
    title: "HubSpot Marketing Hub Reviews 2026",
    provider: "openai",
    citations: 12,
    excerpt: "Rated highly for all-in-one CRM, automation depth, and onboarding quality.",
  },
  {
    domain: "hubspot.com",
    title: "Marketing Hub Enterprise Features",
    provider: "anthropic",
    citations: 11,
    excerpt: "Frequently cited for workflows, lead scoring, and reporting flexibility.",
  },
  {
    domain: "capterra.com",
    title: "Best Marketing Automation Tools",
    provider: "perplexity",
    citations: 10,
    excerpt: "HubSpot appears as a top recommendation for integrated marketing stacks.",
  },
  {
    domain: "forrester.com",
    title: "B2B Revenue Platforms Wave",
    provider: "google",
    citations: 9,
    excerpt: "Strength in ecosystem breadth and measurable campaign performance.",
  },
  {
    domain: "salesforce.com",
    title: "Marketing Cloud Competitor Overview",
    provider: "google-ai-overview",
    citations: 8,
    excerpt: "Compared on enterprise depth, native integrations, and operational control.",
  },
  {
    domain: "gartner.com",
    title: "CRM and Marketing Suites Market Guide",
    provider: "openai",
    citations: 7,
    excerpt: "Balanced trade-off between time-to-value and total ownership cost.",
  },
] as const;

export const PREVIEW_HERO_METRICS = [
  { label: "Prompt Runs", value: "12.4K", detail: "last 30 days" },
  { label: "Models Tracked", value: "5", detail: "provider-normalized outputs" },
  { label: "Citations Indexed", value: "91K", detail: "source-linked and deduplicated" },
] as const;

export const PREVIEW_AGGREGATE_STATS = {
  presenceRate: 84,
  rank: 2,
  topSource: "hubspot.com",
  topCompetitor: "Salesforce",
  topCompetitorDomain: "salesforce.com",
} as const;
