"use client";

import { TopSources } from "@oneglanse/ui";
import { PREVIEW_SOURCES, PREVIEW_TOTAL_CITATIONS } from "@/lib/preview-data";
import { SourcesMiniPreview } from "@/components/previews/sources-mini-preview";

export function SourceIntelligencePreview(): React.JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
      <TopSources sources={PREVIEW_SOURCES} totalCitations={PREVIEW_TOTAL_CITATIONS} />
      <SourcesMiniPreview />
    </div>
  );
}
