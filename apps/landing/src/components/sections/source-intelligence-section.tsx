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
				title="Inspect sources cited in captured answers."
				description="Review cited pages and domains returned by the supported AI product interfaces."
			/>
			<SourceIntelligencePreview />
		</section>
	);
}
