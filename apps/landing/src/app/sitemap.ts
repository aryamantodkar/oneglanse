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
	];
}
