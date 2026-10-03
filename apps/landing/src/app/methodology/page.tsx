import { MethodologyArticle } from "@/components/content/methodology-article";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { SITE_URLS, SOCIAL_METADATA } from "@/lib/landing-content";
import type { Metadata } from "next";

const title = "AI Visibility & GEO Tracking Methodology";
const description =
	"Learn how OneGlanse collects rendered AI product responses and analyzes samples for AI visibility and GEO (Generative Engine Optimization), with clear limits on UI-versus-API comparisons.";

export const metadata: Metadata = {
	title: `${title} | OneGlanse`,
	description,
	alternates: {
		canonical: SITE_URLS.methodology,
	},
	openGraph: {
		...SOCIAL_METADATA.openGraph,
		title: `${title} | OneGlanse`,
		description,
		url: SITE_URLS.methodology,
	},
	twitter: {
		...SOCIAL_METADATA.twitter,
		title: `${title} | OneGlanse`,
		description,
	},
};

export default function MethodologyPage(): React.JSX.Element {
	return (
		<>
			<SiteHeader />
			<main className="section-shell py-12 sm:py-16">
				<MethodologyArticle />
			</main>
			<SiteFooter />
		</>
	);
}
