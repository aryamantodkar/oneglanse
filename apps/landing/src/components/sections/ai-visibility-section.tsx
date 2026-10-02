import { AiVisibilityPreview } from "@/components/previews/ai-visibility-preview";
import { SectionHeading } from "@oneglanse/ui";

export function AiVisibilitySection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="competitor-comparison"
			aria-labelledby="competitor-comparison-title"
		>
			<SectionHeading
				eyebrow="Competitor comparison"
				title="See who shows up with you"
				description="Compare mentions, recommendations, and sentiment across the AI products you track."
			/>
			<AiVisibilityPreview />
		</section>
	);
}
