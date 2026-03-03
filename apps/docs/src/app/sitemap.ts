import type { MetadataRoute } from "next";

const BASE_URL = "https://oneglanse.com/docs";

const routes = [
  "",
  "/getting-started",
  "/self-hosting",
  "/architecture",
  "/providers",
  "/proxy-setup",
  "/vps-deployment",
  "/environment-variables",
  "/troubleshooting",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
