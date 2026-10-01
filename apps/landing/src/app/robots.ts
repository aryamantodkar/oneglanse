import { SITE_URLS } from "@/lib/landing-content";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: SITE_URLS.sitemap,
	};
}
