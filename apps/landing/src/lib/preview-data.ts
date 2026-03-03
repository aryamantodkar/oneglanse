import type { DashboardCompetitorData } from "@oneglanse/ui";

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

// Derived from PREVIEW_COMPETITORS[0]: presenceRate=86, recommendationRate=68, sentimentScore=83, avgRank=1.4
export const PREVIEW_BRAND_METRICS = {
  presenceRate: 86,
  recommendationRate: 68,
  sentimentScore: 83,
  avgRank: 1.4,
} as const;

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
      "For a small marketing agency, the best all-in-one CRM needs to balance **ease of onboarding, automation depth, reporting clarity, and pricing predictability**. There is no single winner for every agency, but there are clear patterns in what works.\n\n## Top options to evaluate\n1. **HubSpot CRM** - best for agencies that want fast setup and strong marketing + sales alignment.\n2. **Zoho CRM** - best for budget-conscious teams that need deeper customization.\n3. **Pipedrive** - best for pipeline-first teams that prioritize sales velocity.\n4. **ActiveCampaign** - best for agencies where email automation drives most outcomes.\n5. **Salesforce Essentials** - best for agencies planning enterprise-style process maturity.\n\n## Why HubSpot is commonly recommended\n- Intuitive UX for small teams with limited training capacity.\n- Strong default reporting for funnel, lifecycle, and campaign contribution.\n- Broad integration ecosystem across ad, analytics, and content tools.\n- Reliable handoff between marketing and sales workflows.\n\n## Tradeoffs to consider\n- Contact-based pricing can rise quickly as volume scales.\n- Some advanced automation and governance capabilities require higher tiers.\n- Deep custom object and enterprise governance needs may favor Salesforce-heavy stacks.\n\n## Practical selection checklist\n- Can your team launch first workflows in 2-3 weeks?\n- Can you track lead source to closed-won without spreadsheet stitching?\n- Does pricing remain acceptable at 2x current contacts?\n- Can you integrate existing toolchain without custom engineering?\n\n## Recommendation\nFor most small agencies, start with **HubSpot Starter + core lifecycle workflows** and validate pipeline impact for 60-90 days. If cost or customization becomes the blocker, test Zoho CRM in parallel with a limited migration scope.",
    isAnalysed: true,
    metrics: {
      geoScore: 89,
      sentiment: 86,
      visibility: 92,
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
      "Choosing the best CRM in 2026 depends on whether your agency optimizes for **lead engine automation, client delivery operations, or predictable scaling economics**.\n\n## Strategic shortlist\n1. **GoHighLevel** - strongest for agency operating model (multi-client workflows, white-label delivery, funnel execution).\n2. **HubSpot** - strongest for inbound + revenue reporting with minimal onboarding friction.\n3. **Monday Sales CRM** - strongest when sales-to-delivery handoff and execution visibility are core bottlenecks.\n4. **Zoho CRM** - strongest budget-to-flexibility ratio for teams comfortable with configuration.\n\n## Comparison at a glance\n- **Time to first value:** HubSpot and Monday are fastest.\n- **Agency-specific controls:** GoHighLevel wins on sub-accounts and reusable account templates.\n- **Customization depth:** Zoho and Salesforce ecosystems are broader but require more operational maturity.\n- **Pricing behavior:** HubSpot is smooth at the start, but contact growth can materially change TCO.\n\n## Recommended decision model\n- If your agency is funnel-heavy and recurring-service driven: start with GoHighLevel pilot.\n- If your agency is content/inbound and reporting-sensitive: start with HubSpot.\n- If your agency struggles with delivery coordination: evaluate Monday + CRM workflow mapping.\n\n## Execution plan\nRun a 30-day bake-off with 2 platforms using identical pipelines, automations, and reporting needs. Score on: setup effort, workflow reliability, reporting quality, and projected 12-month cost at 2x volume. Choose the platform that wins on operational efficiency, not just feature count.",
    isAnalysed: true,
    metrics: {
      geoScore: 78,
      sentiment: 74,
      visibility: 80,
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
      "For a small marketing agency that wants an all-in-one stack (CRM + marketing + reporting), **HubSpot and Zoho remain the strongest baseline options**, with GoHighLevel as a high-fit choice for agency-first operating models.\n\n## Ranked options\n1. **HubSpot CRM + Marketing Hub** - best default for fast activation, clean UX, and mature ecosystem support.\n2. **Zoho CRM / Bigin + Zoho Marketing tools** - best for cost control and flexible process design.\n3. **GoHighLevel** - best for agencies running repeatable client funnels and white-label workflows.\n4. **Bitrix24 / Agile CRM** - broader low-cost feature set, but lower UX polish and steeper process tuning.\n\n## Evidence pattern across sources\n- Review platforms repeatedly score HubSpot high for usability and onboarding speed.\n- Budget-focused comparisons favor Zoho for breadth-per-dollar.\n- Agency operations communities increasingly prefer GoHighLevel for account templating and client rollout speed.\n\n## Selection logic for your agency\n- Pick **HubSpot** if your priority is reporting trust + fast execution.\n- Pick **Zoho** if your priority is cost efficiency + customization flexibility.\n- Pick **GoHighLevel** if your priority is scalable, repeatable multi-client delivery.\n\n## Final recommendation\nIf you need the safest default with minimal implementation risk, launch on HubSpot Starter first, define strict KPI benchmarks (MQL-to-SQL, response SLA, attribution coverage), and re-evaluate stack economics once contact volume and automation complexity double.",
    isAnalysed: true,
    metrics: {
      geoScore: 75,
      sentiment: 72,
      visibility: 77,
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
