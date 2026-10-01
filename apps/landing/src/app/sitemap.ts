import type { MetadataRoute } from "next";
import { SITE_URLS } from "@/lib/landing-content";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: SITE_URLS.homepage,
		},
		{
			url: SITE_URLS.methodology,
		},
	];
}
