import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: "https://oneglanse.com",
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: "https://oneglanse.com/#open-source",
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
	];
}
