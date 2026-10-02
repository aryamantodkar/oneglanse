import { SourceIntelligencePreview } from "@/components/previews/source-intelligence-preview";
import { SectionHeading } from "@oneglanse/ui";

export function SourceIntelligenceSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="source-intelligence"
			aria-labelledby="source-intelligence-title"
		>
			<SectionHeading
				eyebrow="Sources & Citations"
				title="See which sources AI cites"
				description="Find the pages and domains that keep appearing in your answers."
			/>
			<SourceIntelligencePreview />
		</section>
	);
}
