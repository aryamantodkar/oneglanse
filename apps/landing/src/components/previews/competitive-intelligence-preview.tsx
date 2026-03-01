import { CompetitiveLandscape } from "@oneglanse/ui";
import { PREVIEW_COMPETITORS } from "@/lib/preview-data";

export function CompetitiveIntelligencePreview(): React.JSX.Element {
  return <CompetitiveLandscape competitors={PREVIEW_COMPETITORS} />;
}
