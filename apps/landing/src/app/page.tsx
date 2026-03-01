import { ArchitectureSection } from "@/components/landing/architecture-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HeroSection } from "@/components/landing/hero-section";
import { OpenSourceSection } from "@/components/landing/open-source-section";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage(): React.JSX.Element {
  return (
    <main>
      <HeroSection />
      <FeatureGrid />
      <ArchitectureSection />
      <OpenSourceSection />
      <SiteFooter />
    </main>
  );
}
