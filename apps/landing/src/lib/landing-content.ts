import {
  Activity,
  Boxes,
  Database,
  Eye,
  Globe,
  Radar,
  SearchCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: "AI Visibility Tracking",
    description: "Track where and how often your brand appears in model answers.",
    icon: Eye,
  },
  {
    title: "GEO Monitoring",
    description: "Measure recommendation quality, ranking position, and perception over time.",
    icon: Radar,
  },
  {
    title: "Multi-Provider Prompt Testing",
    description: "Run the same prompts across ChatGPT, Claude, Perplexity, and Gemini.",
    icon: SearchCheck,
  },
  {
    title: "Self-hostable Architecture",
    description: "Deploy the full stack in your own infrastructure with Docker.",
    icon: Boxes,
  },
  {
    title: "Proxy-aware Scraping",
    description: "Use provider-isolated workers with proxy scoring, cooldowns, and retries.",
    icon: Globe,
  },
  {
    title: "ClickHouse Analytics",
    description: "Store prompt responses and analysis at scale for fast reporting.",
    icon: Database,
  },
  {
    title: "Open-source Transparency",
    description: "Audit the entire decision pipeline from prompt run to analytics output.",
    icon: Activity,
  },
];

export const ARCHITECTURE_NODES = [
  {
    title: "Web App",
    description: "Authenticated dashboard for workspace setup, prompts, schedules, and metrics.",
  },
  {
    title: "Agent Worker",
    description: "Playwright-based provider workers process prompt queues and capture responses.",
  },
  {
    title: "Redis",
    description: "BullMQ queue backbone for per-provider job orchestration and progress tracking.",
  },
  {
    title: "ClickHouse",
    description: "Analytics store for prompt responses, sources, and computed GEO insights.",
  },
  {
    title: "Docker Deployment",
    description: "Compose-based separation for web, agent, data stores, and runtime environment.",
  },
] as const;
