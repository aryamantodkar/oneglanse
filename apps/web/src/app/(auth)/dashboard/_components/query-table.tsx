import React from "react";
import type { AnalysisRecord } from "@onescope/types";
import {
  Card
} from "@onescope/ui";
import { getModelFavicon, modelSelectors } from "@onescope/utils";
import { ExternalLink } from "lucide-react";
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
  return (
    <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
      
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold">
          Prompt Visibility
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Compare prompts by coverage, sentiment, and recommendation strength.
        </p>
      </div>

      <div className="mt-2 space-y-4">
        {groupedRecords.map((group) => {
          const geoColor = getGeoScoreColor(group.avgScore);
          const sentimentColor = getSentimentColor(group.avgSentiment);

          return (
            <div
              key={group.prompt}
              className="rounded-lg border border-gray-100 p-4 dark:border-gray-800"
            >
              {/* Prompt + Metrics */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                
                {/* Prompt */}
                <div>
                  <p className="text-sm font-medium leading-snug">
                    {group.prompt}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {group.records.length} model
                    {group.records.length !== 1 ? "s" : ""} •{" "}
                    {recTypeLabels[group.topRecType] ?? group.topRecType}
                  </p>
                </div>

                {/* Compact Metrics */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Avg Score{" "}
                    <span style={{ color: geoColor }} className="font-medium">
                      {group.avgScore}
                    </span>
                  </span>

                  <span className="rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Rank{" "}
                    <span className="font-medium">
                      {group.bestRank ? `#${group.bestRank}` : "—"}
                    </span>
                  </span>

                  <span className="rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700">
                    Sentiment{" "}
                    <span className={`font-medium ${sentimentColor.text}`}>
                      {group.avgSentiment}
                    </span>
                  </span>
                </div>
              </div>

              {/* Model Results */}
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  Model Results
                </p>

                <div className="space-y-2">
                  {group.records.map((record) => {
                    const ba = record.brand_analysis!;
                    const scoreColor = getGeoScoreColor(
                      ba.geoScore.overall
                    );
                    const sentColor = getSentimentColor(
                      ba.sentiment.score
                    );

                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() =>
                          onSelectRecord(record.prompt)
                        }
                        className="flex w-full items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-left transition hover:bg-muted/50 dark:border-gray-800"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={getModelFavicon(
                              record.model_provider
                            )}
                            alt={record.model_provider}
                            className="h-5 w-5 rounded-sm"
                          />
                          <span className="text-sm font-medium">
                            {
                              modelSelectors.find(
                                (m) =>
                                  m.value ===
                                  record.model_provider
                              )?.label
                            }
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <span
                            style={{ color: scoreColor }}
                            className="font-medium"
                          >
                            {ba.geoScore.overall}
                          </span>

                          <span
                            className={`font-medium ${sentColor.text}`}
                          >
                            {ba.sentiment.score}
                          </span>

                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}