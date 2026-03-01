export type DocSection = {
  slug: string;
  title: string;
  description: string;
};

export const DOC_SECTIONS: DocSection[] = [
  { slug: "introduction", title: "Introduction", description: "What OneGlanse solves and who it is for." },
  { slug: "architecture", title: "Architecture", description: "Service boundaries and data flow across the monorepo." },
  { slug: "quick-start", title: "Quick Start", description: "Install, configure, and run locally." },
  { slug: "docker-setup", title: "Docker Setup", description: "Bring up core services with compose." },
  { slug: "environment-variables", title: "Environment Variables", description: "Required and optional runtime configuration." },
  { slug: "vps-deployment", title: "VPS Deployment", description: "Production deployment approach on a VPS." },
  { slug: "proxy-configuration", title: "Proxy Configuration", description: "Proxy source modes, scoring, and rotation behavior." },
  { slug: "authentication-flow", title: "Authentication Flow", description: "How user auth and provider auth sessions are handled." },
  { slug: "production-best-practices", title: "Production Best Practices", description: "Scaling, observability, resilience, and security guidelines." },
  { slug: "troubleshooting", title: "Troubleshooting", description: "Common failure modes and how to recover quickly." }
];

export const DEFAULT_DOC_SLUG = "introduction";
