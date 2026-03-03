import { SectionHeading } from "@/components/common/section-heading";
import { CompetitiveLandscape } from "@oneglanse/ui";
import { PREVIEW_COMPETITORS } from "@/lib/preview-data";

export function VisibilityScoreboardSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="visibility-scoreboard"
      aria-labelledby="visibility-scoreboard-title"
    >
      <SectionHeading
        eyebrow="Visibility Scoreboard"
        title="Visibility, mentions, and sentiment in one table."
      />
      <CompetitiveLandscape competitors={PREVIEW_COMPETITORS} />
    </section>
  );
}
