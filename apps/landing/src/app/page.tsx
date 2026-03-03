import { AiVisibilitySection } from "@/components/sections/ai-visibility-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { DataCollectionSection } from "@/components/sections/data-collection-section";
import { HeroSection } from "@/components/sections/hero-section";
import { OpenSourceSection } from "@/components/sections/open-source-section";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { SourceIntelligenceSection } from "@/components/sections/source-intelligence-section";

export default function LandingPage(): React.JSX.Element {
  return (
    <main>
      <SiteHeader />
      <HeroSection />
      <FeatureGrid />
      <AiVisibilitySection />
      <SourceIntelligenceSection />
      <OpenSourceSection />
      <DataCollectionSection />
      <SiteFooter />
    </main>
  );
}
