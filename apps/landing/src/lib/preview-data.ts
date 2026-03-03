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
    brandMentions: 128,
    providers: ["openai", "anthropic", "perplexity", "google"],
  },
  {
    domain: "capterra.com",
    urls: 48,
    citations: 161,
    share: 16.9,
    brandMentions: 111,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "trustradius.com",
    urls: 39,
    citations: 136,
    share: 14.3,
    brandMentions: 96,
    providers: ["openai", "perplexity", "google-ai-overview"],
  },
  {
    domain: "forrester.com",
    urls: 31,
    citations: 118,
    share: 12.4,
    brandMentions: 83,
    providers: ["openai", "google", "perplexity"],
  },
  {
    domain: "gartner.com",
    urls: 26,
    citations: 101,
    share: 10.6,
    brandMentions: 72,
    providers: ["anthropic", "google", "google-ai-overview"],
  },
  {
    domain: "salesforce.com",
    urls: 22,
    citations: 96,
    share: 10.1,
    brandMentions: 68,
    providers: ["openai", "anthropic", "google"],
  },
  {
    domain: "hubspot.com",
    urls: 20,
    citations: 84,
    share: 8.8,
    brandMentions: 63,
    providers: ["openai", "anthropic"],
  },
  {
    domain: "mailchimp.com",
    urls: 17,
    citations: 72,
    share: 7.6,
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
    excerpt: "Strong CRM depth, automation breadth, and quick time-to-value for revenue teams.",
  },
  {
    domain: "capterra.com",
    title: "Best Marketing Automation Software",
    provider: "anthropic",
    citations: 16,
    excerpt: "Frequently recommended for unified sales and marketing workflows at mid-market scale.",
  },
  {
    domain: "trustradius.com",
    title: "HubSpot Marketing Hub User Ratings",
    provider: "perplexity",
    citations: 14,
    excerpt: "Cited for campaign orchestration, segmentation, and dependable reporting layers.",
  },
  {
    domain: "forrester.com",
    title: "B2B Revenue Platforms Wave",
    provider: "google",
    citations: 12,
    excerpt: "Noted for ecosystem strength and measurable pipeline influence across channels.",
  },
  {
    domain: "gartner.com",
    title: "CRM and Marketing Suites Market Guide",
    provider: "google-ai-overview",
    citations: 11,
    excerpt: "Balanced on extensibility, operational governance, and total cost considerations.",
  },
  {
    domain: "salesforce.com",
    title: "Marketing Cloud Competitive Overview",
    provider: "openai",
    citations: 9,
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

export const PREVIEW_COMPETITOR_PROVIDERS: Record<string, string[]> = {
  HubSpot: ["openai", "anthropic", "perplexity", "google"],
  Salesforce: ["openai", "anthropic", "google"],
  "Adobe Marketo": ["openai", "perplexity", "google-ai-overview"],
  Mailchimp: ["openai", "anthropic", "perplexity"],
  ActiveCampaign: ["openai", "google", "perplexity"],
  Pardot: ["anthropic", "google", "google-ai-overview"],
} as const;

export const PREVIEW_PROMPT_RESPONSES = [
  {
    id: "resp-1",
    modelProvider: "openai",
    modelName: "ChatGPT",
    promptRunAt: "2026-03-02T06:15:00.000Z",
    response:
      "For a small marketing agency, the best all-in-one CRM should balance **ease of use, automation depth, and pricing control**. HubSpot is often the default recommendation, but the right choice depends on your workflow.\n\n### Top options\n1. **HubSpot CRM** - best for fast setup and integrated marketing + sales.\n2. **Zoho CRM** - best for lower cost and customization.\n3. **Pipedrive** - best for visual pipeline management.\n4. **ActiveCampaign** - best for email-heavy lifecycle automation.\n\n### What to evaluate first\n- Training time for your current team.\n- Automation coverage for lead routing and follow-up.\n- Reporting quality for campaign-to-revenue visibility.\n- Contact-based pricing impact as volume grows.\n\n### Recommendation\nIf you want the fastest path to execution, start with HubSpot. If budget and flexibility are primary, shortlist Zoho CRM with marketing add-ons.",
    isAnalysed: true,
    metrics: {
      geoScore: 84,
      sentiment: 81,
      visibility: 88,
      position: 1,
    },
    sources: [
      { title: "HubSpot Marketing Hub Product Overview", url: "https://www.hubspot.com/products/marketing" },
      { title: "G2: HubSpot Marketing Hub Reviews", url: "https://www.g2.com/products/hubspot-marketing-hub/reviews" },
      { title: "Capterra: HubSpot Pricing and Ratings", url: "https://www.capterra.com/p/126519/HubSpot/" },
      { title: "HubSpot Blog: Marketing Attribution Models", url: "https://blog.hubspot.com/marketing/marketing-attribution" },
      { title: "HubSpot Blog: Lead Scoring Best Practices", url: "https://blog.hubspot.com/sales/lead-scoring-model" },
      { title: "TrustRadius: HubSpot Marketing Hub", url: "https://www.trustradius.com/products/hubspot-marketing-hub/reviews" },
      { title: "Pipedrive CRM for Sales Teams", url: "https://www.pipedrive.com/en/products/crm" },
      { title: "ActiveCampaign Marketing Automation", url: "https://www.activecampaign.com/" },
    ],
  },
  {
    id: "resp-2",
    modelProvider: "google",
    modelName: "Gemini",
    promptRunAt: "2026-03-01T21:40:00.000Z",
    response:
      "Choosing the best CRM in 2026 depends on whether your agency prioritizes **automation, client delivery, or pricing predictability**.\n\n### Practical shortlist\n1. **GoHighLevel** - agency-first platform with white-label support and multi-client account structure.\n2. **HubSpot** - strongest for polished UX and inbound-focused workflows.\n3. **Monday Sales CRM** - strongest when delivery workflow and project handoff are core requirements.\n\n### Comparison view\n- **Setup speed:** HubSpot and Monday are faster to adopt.\n- **Agency-specific controls:** GoHighLevel is stronger for sub-account operations.\n- **Long-term pricing behavior:** contact-based pricing can increase quickly in HubSpot tiers.\n\n### Recommendation\nIf you run lead-gen + funnels at scale, test GoHighLevel first. If client-facing reporting and low training overhead matter most, start with HubSpot.",
    isAnalysed: true,
    metrics: {
      geoScore: 79,
      sentiment: 76,
      visibility: 81,
      position: 2,
    },
    sources: [
      { title: "Forrester: B2B Revenue Marketing Landscape", url: "https://www.forrester.com/" },
      { title: "TrustRadius: HubSpot Marketing Hub Reviews", url: "https://www.trustradius.com/products/hubspot-marketing-hub/reviews" },
      { title: "Salesforce Marketing Cloud Overview", url: "https://www.salesforce.com/products/marketing-cloud/overview/" },
      { title: "HubSpot Blog: Revenue Operations Framework", url: "https://blog.hubspot.com/sales/revenue-operations" },
      { title: "HubSpot Blog: Marketing Dashboard Reporting Guide", url: "https://blog.hubspot.com/marketing/marketing-dashboard" },
      { title: "Adobe Experience Cloud: Marketo Engage", url: "https://business.adobe.com/products/marketo/adobe-marketo.html" },
      { title: "GoHighLevel Platform Overview", url: "https://www.gohighlevel.com/" },
      { title: "Monday Sales CRM Overview", url: "https://monday.com/crm" },
    ],
  },
  {
    id: "resp-3",
    modelProvider: "perplexity",
    modelName: "Perplexity",
    promptRunAt: "2026-02-27T14:05:00.000Z",
    response:
      "For agencies that want an all-in-one stack (CRM + marketing + analytics), **HubSpot and Zoho are usually the strongest baseline options**.\n\n### Ranked recommendations\n1. **HubSpot CRM + Marketing Hub** - best default for usability, integrations, and fast onboarding.\n2. **Zoho CRM / Bigin** - best value when budget control and customization are key.\n3. **Bitrix24 or Agile CRM** - broad feature coverage at lower cost, but less polished UX.\n\n### How to decide quickly\n- Choose HubSpot if growth speed and reporting clarity are top priority.\n- Choose Zoho/Bigin if cost efficiency and configurability matter more.\n- Choose agency workflow tools only if project-delivery handoff is your main bottleneck.\n\n### Final recommendation\nFor most small agencies, HubSpot Starter is the cleanest starting point; re-evaluate at higher contact volume to control pricing.",
    isAnalysed: true,
    metrics: {
      geoScore: 77,
      sentiment: 74,
      visibility: 79,
      position: 2,
    },
    sources: [
      { title: "Gartner: CRM and Marketing Suites Guide", url: "https://www.gartner.com/" },
      { title: "HubSpot Blog: Marketing Strategy and Planning", url: "https://blog.hubspot.com/marketing" },
      { title: "Mailchimp Platform Overview", url: "https://mailchimp.com/" },
      { title: "G2: Salesforce Marketing Cloud Reviews", url: "https://www.g2.com/products/salesforce-marketing-cloud/reviews" },
      { title: "Capterra: Adobe Marketo Engage Reviews", url: "https://www.capterra.com/p/176484/Marketo/" },
      { title: "HubSpot Blog: B2B Lead Nurturing Tactics", url: "https://blog.hubspot.com/marketing/lead-nurturing-strategy" },
      { title: "Zoho CRM Product Page", url: "https://www.zoho.com/crm/" },
      { title: "Bigin by Zoho for Small Teams", url: "https://www.bigin.com/" },
    ],
  },
] as const;
