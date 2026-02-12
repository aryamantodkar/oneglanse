import React, { useMemo, useState } from "react";
import type { AnalysisRecord } from "@onescope/types";
import {
  Card
} from "@onescope/ui";
import { getModelFavicon, modelSelectors } from "@onescope/utils";
import { ChevronDown, ExternalLink } from "lucide-react";
import { getGeoScoreColor, getSentimentColor } from "../_utils/helpers";
import { recTypeLabels } from "../_utils/constants";

export function QueryLevelTable({
  groupedRecords,
  onSelectRecord,
}: {
  groupedRecords: Array<{
    prompt: string;
    records: AnalysisRecord[];
    avgScore: number;
    avgSentiment: number;
    bestRank: number | null;
    topRecType: string;
  }>;
  onSelectRecord: (prompt: string) => void;
}) {
  const modelOptions = useMemo(() => {
    const unique = new Set<string>();
    groupedRecords.forEach((group) => {
      group.records.forEach((record) => unique.add(record.model_provider));
    });

    return [
      { value: "all", label: "All models" },
      ...Array.from(unique).map((value) => ({
        value,
        label: modelSelectors.find((m) => m.value === value)?.label ?? value,
      })),
    ];
  }, [groupedRecords]);

  const [modelFilter, setModelFilter] = useState("all");

  return (
    <Card className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Queries
          </p>
          <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Prompt Visibility
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Clean, compact view with fast model switching.
          </p>
        </div>

        {/* Model Filter */}
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
          {modelOptions.map((model) => (
            <button
              key={model.value}
              onClick={() => setModelFilter(model.value)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                modelFilter === model.value
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              type="button"
            >
              {model.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 divide-y divide-gray-200 dark:divide-gray-800">
        {groupedRecords.map((group) => {
          const geoColor = getGeoScoreColor(group.avgScore);
          const sentimentColor = getSentimentColor(group.avgSentiment);
          const filteredRecords =
            modelFilter === "all"
              ? group.records
              : group.records.filter((r) => r.model_provider === modelFilter);

          return (
            <details key={group.prompt} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                {/* Prompt */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {group.prompt}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filteredRecords.length} model
                    {filteredRecords.length !== 1 ? "s" : ""} •{" "}
                    {recTypeLabels[group.topRecType] ?? group.topRecType}
                  </p>
                </div>

                {/* Metrics */}
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="rounded-full border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Score{" "}
                    <span style={{ color: geoColor }} className="font-medium">
                      {group.avgScore}
                    </span>
                  </span>
                  <span className="rounded-full border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Rank{" "}
                    <span className="font-medium">
                      {group.bestRank ? `#${group.bestRank}` : "—"}
                    </span>
                  </span>
                  <span className="rounded-full border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Sent{" "}
                    <span className={`font-medium ${sentimentColor.text}`}>
                      {group.avgSentiment}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </div>
              </summary>

              {/* Model Results */}
              <div className="mt-3 space-y-2">
                {filteredRecords.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No results for this model.
                  </p>
                )}
                {filteredRecords.map((record) => {
                  const ba = record.brand_analysis!;
                  const scoreColor = getGeoScoreColor(ba.geoScore.overall);
                  const sentColor = getSentimentColor(ba.sentiment.score);

                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => onSelectRecord(record.prompt)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:border-gray-300 dark:border-gray-800"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getModelFavicon(record.model_provider)}
                          alt={record.model_provider}
                          className="h-4 w-4 rounded-sm"
                        />
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {
                            modelSelectors.find(
                              (m) => m.value === record.model_provider
                            )?.label
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span style={{ color: scoreColor }} className="font-medium">
                          {ba.geoScore.overall}
                        </span>
                        <span className={`font-medium ${sentColor.text}`}>
                          {ba.sentiment.score}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
