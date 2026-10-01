import { SITE_URLS, SOCIAL_METADATA } from "@/lib/landing-content";
import type { Metadata } from "next";

export function contentMetadata(
	title: string,
	description: string,
	path: string,
): Metadata {
	const url = `${SITE_URLS.homepage}${path}`;
	const fullTitle = `${title} | OneGlanse`;
	return {
		title: fullTitle,
		description,
		alternates: { canonical: url },
		openGraph: {
			...SOCIAL_METADATA.openGraph,
			title: fullTitle,
			description,
			url,
		},
		twitter: { ...SOCIAL_METADATA.twitter, title: fullTitle, description },
	};
}
