import { comparisons } from "@/content/comparisons";
import { guides } from "@/content/guides";
import { categories } from "@/content/tools";
import { SITE_URLS } from "@/lib/landing-content";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: SITE_URLS.homepage,
		},
		{
			url: SITE_URLS.methodology,
		},
		...[
			"/why-self-hosted",
			"/ai-visibility-tools",
			"/compare",
			"/guides",
			...Object.keys(categories).map(
				(category) => `/ai-visibility-tools/${category}`,
			),
			...comparisons.map((comparison) => `/compare/${comparison.slug}`),
			...guides.map((guide) => `/guides/${guide.slug}`),
		].map((path) => ({ url: `${SITE_URLS.homepage}${path}` })),
	];
}
