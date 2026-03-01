import { AiVisibilitySection } from "@/components/sections/ai-visibility-section";
import { CompetitiveIntelligenceSection } from "@/components/sections/competitive-intelligence-section";
import { DataCollectionSection } from "@/components/sections/data-collection-section";
import { HeroSection } from "@/components/sections/hero-section";
import { HowItWorksSection } from "@/components/sections/how-it-works-section";
import { ModelSupportSection } from "@/components/sections/model-support-section";
import { OpenSourceSection } from "@/components/sections/open-source-section";
import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { SourceIntelligenceSection } from "@/components/sections/source-intelligence-section";

export default function LandingPage(): React.JSX.Element {
  return (
    <main>
      <SiteHeader />
      <HeroSection />
      <DataCollectionSection />
      <AiVisibilitySection />
      <SourceIntelligenceSection />
      <CompetitiveIntelligenceSection />
      <ModelSupportSection />
      <OpenSourceSection />
      <HowItWorksSection />
      <SiteFooter />
    </main>
  );
}
