import "./globals.css";
import {
	PRODUCT_SUMMARY,
	SITE_TITLE,
	SITE_URLS,
	SOCIAL_METADATA,
} from "@/lib/landing-content";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const DISCOVERY_KEYWORDS = [
	"AI visibility",
	"AI visibility tracker",
	"AI visibility tracking",
	"AI search analytics",
	"AI search optimization",
	"AEO",
	"answer engine optimization",
	"GEO",
	"generative engine optimization",
	"LLMO",
	"brand monitoring",
	"open-source AI visibility",
	"self-hosted AI visibility",
	"oneglanse",
] as const;

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URLS.homepage),
	title: SITE_TITLE,
	description: PRODUCT_SUMMARY,
	keywords: [...DISCOVERY_KEYWORDS],
	alternates: {
		canonical: SITE_URLS.homepage,
	},
	openGraph: {
		...SOCIAL_METADATA.openGraph,
		title: SITE_TITLE,
		description: PRODUCT_SUMMARY,
		url: SITE_URLS.homepage,
	},
	twitter: {
		...SOCIAL_METADATA.twitter,
		title: SITE_TITLE,
		description: PRODUCT_SUMMARY,
	},
};

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: "OneGlanse",
	url: SITE_URLS.homepage,
	description: PRODUCT_SUMMARY,
	applicationCategory: "BusinessApplication",
	operatingSystem: "Linux, macOS, Windows",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	license: SITE_URLS.githubLicense,
	codeRepository: SITE_URLS.github,
	author: {
		"@type": "Organization",
		name: "OneGlanse",
		url: SITE_URLS.homepage,
		sameAs: [SITE_URLS.github],
	},
	keywords: DISCOVERY_KEYWORDS.join(", "),
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<html lang="en" className={geist.variable} suppressHydrationWarning>
			<head>
				<link rel="describedby" href="/llms.txt" type="text/markdown" />
			</head>
			<body>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for search engines
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
