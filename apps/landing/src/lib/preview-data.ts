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
    appearances: 384,
    visibility: 86,
    avgSentiment: 83,
    avgRank: 1.4,
    recCount: 291,
    winsOver: ["Salesforce", "Marketo", "Mailchimp"],
    losesTo: [],
    isBrand: true,
  },
  {
    name: "Salesforce",
    domain: "salesforce.com",
    appearances: 301,
    visibility: 71,
    avgSentiment: 76,
    avgRank: 2.2,
    recCount: 206,
    winsOver: ["Marketo", "Pardot"],
    losesTo: ["HubSpot"],
  },
  {
    name: "Adobe Marketo",
    domain: "adobe.com",
    appearances: 237,
    visibility: 58,
    avgSentiment: 68,
    avgRank: 2.9,
    recCount: 148,
    winsOver: ["Mailchimp"],
    losesTo: ["HubSpot", "Salesforce"],
  },
  {
    name: "Mailchimp",
    domain: "mailchimp.com",
    appearances: 196,
    visibility: 49,
    avgSentiment: 65,
    avgRank: 3.5,
    recCount: 113,
    winsOver: ["ActiveCampaign"],
    losesTo: ["HubSpot", "Salesforce", "Adobe Marketo"],
  },
  {
    name: "ActiveCampaign",
    domain: "activecampaign.com",
    appearances: 144,
    visibility: 36,
    avgSentiment: 58,
    avgRank: 4.1,
    recCount: 71,
    winsOver: [],
    losesTo: ["HubSpot", "Salesforce", "Adobe Marketo"],
  },
  {
    name: "Pardot",
    domain: "salesforce.com",
    appearances: 109,
    visibility: 28,
    avgSentiment: 54,
    avgRank: 4.8,
    recCount: 52,
    winsOver: [],
    losesTo: ["HubSpot", "Salesforce", "Adobe Marketo"],
  },
];

export const PREVIEW_SOURCES: DashboardSourceData[] = [
  {
    domain: "g2.com",
    favicon: null,
    citationCount: 184,
    uniqueRecords: new Set(["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"]),
    models: new Set(["openai", "anthropic", "google", "perplexity"]),
  },
  {
    domain: "capterra.com",
    favicon: null,
    citationCount: 161,
    uniqueRecords: new Set(["r2", "r4", "r5", "r10", "r11", "r12"]),
    models: new Set(["openai", "anthropic", "google"]),
  },
  {
    domain: "trustradius.com",
    favicon: null,
    citationCount: 136,
    uniqueRecords: new Set(["r3", "r5", "r8", "r13", "r14", "r15"]),
    models: new Set(["openai", "perplexity", "google-ai-overview"]),
  },
  {
    domain: "forrester.com",
    favicon: null,
    citationCount: 118,
    uniqueRecords: new Set(["r1", "r6", "r7", "r16", "r17"]),
    models: new Set(["openai", "anthropic", "perplexity"]),
  },
  {
    domain: "gartner.com",
    favicon: null,
    citationCount: 101,
    uniqueRecords: new Set(["r9", "r10", "r18", "r19", "r20"]),
    models: new Set(["anthropic", "google", "google-ai-overview"]),
  },
  {
    domain: "salesforce.com",
    favicon: null,
    citationCount: 96,
    uniqueRecords: new Set(["r21", "r22", "r23", "r24"]),
    models: new Set(["openai", "anthropic", "google"]),
  },
];

export const PREVIEW_TOTAL_RESPONSES = 428;
export const PREVIEW_TOTAL_CITATIONS = 952;

export const PREVIEW_PERCEPTION = {
  bestKnownFor: "unified CRM and marketing automation for revenue teams",
  pricingPerception: "premium",
  coreClaims: [
    "crm, marketing, and service in one platform",
    "strong automation and lead routing",
    "attribution and pipeline reporting depth",
    "large app marketplace for scale",
  ],
  differentiators: [
    "shared contact data model",
    "enterprise workflow tooling",
    "partner ecosystem maturity",
    "fast onboarding for growth teams",
    "cross-hub governance controls",
  ],
} as const;

export const PREVIEW_ALT_PERCEPTION = {
  bestKnownFor: "ease of adoption with operational depth",
  pricingPerception: "mid_range",
  coreClaims: [
    "fast launch for campaign teams",
    "multi-channel orchestration",
    "clear lifecycle automation",
    "solid fit for mid-market ops",
  ],
  differentiators: [
    "journey builders",
    "contact personalization",
    "native reporting",
    "audience segmentation",
  ],
} as const;

export const PREVIEW_SOURCE_GROUPS = [
  {
    domain: "g2.com",
    urls: 56,
    citations: 184,
    share: 19.3,
    trafficShare: 24.1,
    brandMentions: 128,
    providers: ["openai", "anthropic", "perplexity", "google"],
  },
  {
    domain: "capterra.com",
    urls: 48,
    citations: 161,
    share: 16.9,
    trafficShare: 18.8,
    brandMentions: 111,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "trustradius.com",
    urls: 39,
    citations: 136,
    share: 14.3,
    trafficShare: 13.4,
    brandMentions: 96,
    providers: ["openai", "perplexity", "google-ai-overview"],
  },
  {
    domain: "forrester.com",
    urls: 31,
    citations: 118,
    share: 12.4,
    trafficShare: 9.7,
    brandMentions: 83,
    providers: ["openai", "google", "perplexity"],
  },
  {
    domain: "gartner.com",
    urls: 26,
    citations: 101,
    share: 10.6,
    trafficShare: 8.5,
    brandMentions: 72,
    providers: ["anthropic", "google", "google-ai-overview"],
  },
  {
    domain: "salesforce.com",
    urls: 22,
    citations: 96,
    share: 10.1,
    trafficShare: 7.9,
    brandMentions: 68,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "hubspot.com",
    urls: 20,
    citations: 84,
    share: 8.8,
    trafficShare: 9.2,
    brandMentions: 63,
    providers: ["openai", "anthropic"],
  },
  {
    domain: "mailchimp.com",
    urls: 17,
    citations: 72,
    share: 7.6,
    trafficShare: 8.4,
    brandMentions: 58,
    providers: ["openai", "perplexity"],
  },
] as const;

export const PREVIEW_CITATION_ROWS = [
  {
    domain: "g2.com",
    title: "HubSpot Marketing Hub Review Grid",
    provider: "openai",
    citations: 19,
    sentiment: 82,
    excerpt: "Strong CRM depth, automation breadth, and quick time-to-value for revenue teams.",
  },
  {
    domain: "capterra.com",
    title: "Best Marketing Automation Software",
    provider: "anthropic",
    citations: 16,
    sentiment: 77,
    excerpt: "Frequently recommended for unified sales and marketing workflows at mid-market scale.",
  },
  {
    domain: "trustradius.com",
    title: "HubSpot Marketing Hub User Ratings",
    provider: "perplexity",
    citations: 14,
    sentiment: 74,
    excerpt: "Cited for campaign orchestration, segmentation, and dependable reporting layers.",
  },
  {
    domain: "forrester.com",
    title: "B2B Revenue Platforms Wave",
    provider: "google",
    citations: 12,
    sentiment: 69,
    excerpt: "Noted for ecosystem strength and measurable pipeline influence across channels.",
  },
  {
    domain: "gartner.com",
    title: "CRM and Marketing Suites Market Guide",
    provider: "google-ai-overview",
    citations: 11,
    sentiment: 64,
    excerpt: "Balanced on extensibility, operational governance, and total cost considerations.",
  },
  {
    domain: "salesforce.com",
    title: "Marketing Cloud Competitive Overview",
    provider: "openai",
    citations: 9,
    sentiment: 58,
    excerpt: "Compared on enterprise depth and integration strategy in complex buying cycles.",
  },
] as const;

export const PREVIEW_HERO_METRICS = [
  { label: "Prompt Runs", value: "18.7K", detail: "last 30 days" },
  { label: "Models Tracked", value: "6", detail: "normalized outputs" },
  { label: "Citations Indexed", value: "142K", detail: "deduplicated sources" },
] as const;

export const PREVIEW_AGGREGATE_STATS = {
  presenceRate: 86,
  rank: 1,
  topSource: "g2.com",
  topCompetitor: "Salesforce",
  topCompetitorDomain: "salesforce.com",
} as const;
