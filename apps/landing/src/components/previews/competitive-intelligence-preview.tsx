"use client";

import { Card, CompetitiveLandscape } from "@oneglanse/ui";
import { PREVIEW_BRAND, PREVIEW_COMPETITORS } from "@/lib/preview-data";

export function CompetitiveIntelligencePreview(): React.JSX.Element {
  const comparisonRows = PREVIEW_COMPETITORS.slice(0, 4).map((item) => {
    const benchmark = item.isBrand ? 100 : Math.round((item.visibility ?? 0) * 1.1);
    return {
      name: item.name,
      value: Math.max(12, Math.min(100, benchmark)),
      isBrand: item.isBrand,
    };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <CompetitiveLandscape competitors={PREVIEW_COMPETITORS} />
      <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">Brand Comparison Snapshot</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Relative visibility index across the top peers in tracked AI answers.
          </p>
        </div>
        <div className="space-y-3">
          {comparisonRows.map((entry) => (
            <div key={entry.name} className="ui-list-item rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.name}</span>
                <span className="text-muted-foreground">{entry.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${entry.isBrand ? "bg-blue-600" : "bg-gray-400 dark:bg-gray-500"}`}
                  style={{ width: `${entry.value}%` }}
                  aria-hidden="true"
                />
              </div>
              {entry.isBrand ? (
                <p className="mt-2 text-[11px] font-medium text-blue-700 dark:text-blue-300">{PREVIEW_BRAND.name} baseline</p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
