import { PREVIEW_PROMPT_RESPONSES } from "@/lib/preview-data";
import { PromptResponsesPreview } from "@oneglanse/ui";

export function PromptResponsesSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="prompt-responses"
			aria-labelledby="prompt-responses-title"
		>
			<PromptResponsesPreview
				title="Read the actual answers"
				description="Open a saved answer, see its citations, and check the analysis beside it."
				rows={PREVIEW_PROMPT_RESPONSES.map((row) => ({
					id: row.id,
					modelProvider: row.modelProvider,
					modelName: row.modelName,
					promptRunAt: row.promptRunAt,
					response: row.response,
					isAnalysed: row.isAnalysed,
					metrics: row.metrics,
					sources: [...row.sources],
				}))}
			/>
		</section>
	);
}
