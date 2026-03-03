import { PromptResponsesPreview } from "@oneglanse/ui";
import { PREVIEW_PROMPT_RESPONSES } from "@/lib/preview-data";

export function PromptResponsesSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="prompt-responses" aria-labelledby="prompt-responses-title">
      <PromptResponsesPreview
        title="Prompt Responses"
        description="Collapsed provider responses with top-line analysis metrics and source evidence."
        rows={PREVIEW_PROMPT_RESPONSES.map((row) => ({
          id: row.id,
          modelProvider: row.modelProvider,
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
