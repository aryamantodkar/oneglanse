import { AiPerceptionSection } from "@/components/sections/ai-perception-section";
import { AiVisibilitySection } from "@/components/sections/ai-visibility-section";
import { DataCollectionSection } from "@/components/sections/data-collection-section";
import { FaqSection } from "@/components/sections/faq-section";
import { HeroSection } from "@/components/sections/hero-section";
import { OpenSourceSection } from "@/components/sections/open-source-section";
import { PromptResponsesSection } from "@/components/sections/prompt-responses-section";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { SourceIntelligenceSection } from "@/components/sections/source-intelligence-section";
import { SupportedProvidersSection } from "@/components/sections/supported-providers-section";
import { VisibilityScoreboardSection } from "@/components/sections/visibility-scoreboard-section";
import { SITE_URLS } from "@/lib/landing-content";

const websiteJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: "OneGlanse",
	url: SITE_URLS.homepage,
};

export default function LandingPage(): React.JSX.Element {
	return (
		<main>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data for search engines
				dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
			/>
			<SiteHeader />
			<HeroSection />
			<VisibilityScoreboardSection />
			<PromptResponsesSection />
			<AiVisibilitySection />
			<SourceIntelligenceSection />
			<AiPerceptionSection />
			<SupportedProvidersSection />
			<OpenSourceSection />
			<DataCollectionSection />
			<FaqSection />
			<SiteFooter />
		</main>
	);
}
