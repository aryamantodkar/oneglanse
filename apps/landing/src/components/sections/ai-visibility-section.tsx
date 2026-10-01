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
				eyebrow="Competitor Comparison"
				title="Compare brand visibility in AI answers"
				description="Review mentions, recommendations, and sentiment in captured responses from supported AI products."
			/>
			<AiVisibilityPreview />
		</section>
	);
}
