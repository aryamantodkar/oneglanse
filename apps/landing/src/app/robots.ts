import type { MetadataRoute } from "next";
import { SITE_URLS } from "@/lib/landing-content";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: SITE_URLS.sitemap,
	};
}
