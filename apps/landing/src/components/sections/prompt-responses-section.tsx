import { PromptResponsesPreview } from "@oneglanse/ui";
import { PREVIEW_PROMPT_RESPONSES } from "@/lib/preview-data";

export function PromptResponsesSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="prompt-responses" aria-labelledby="prompt-responses-title">
      <PromptResponsesPreview
        title="Real LLM UI Responses"
        description="Review provider-rendered answers exactly as users see them, with source attribution and analysis metrics in one view."
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
