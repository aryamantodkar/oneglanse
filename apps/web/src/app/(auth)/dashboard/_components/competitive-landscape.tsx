import { useMemo, useState } from "react";
import { Card } from "@onescope/ui";
import type { CompetitorData } from "../_utils/types";

export function CompetitiveLandscape({
  competitors,
  brandName,
  brandSentiment,
}: {
  competitors: CompetitorData[];
  brandName: string;
  brandSentiment: number;
}) {
  const [competitorSort, setCompetitorSort] =
    useState<"appearances" | "sentiment" | "rank">("rank");

  const sortedCompetitors = useMemo(() => {
    const sorted = [...competitors];
    switch (competitorSort) {
      case "appearances":
        return sorted.sort((a, b) => b.appearances - a.appearances);
      case "sentiment":
        return sorted.sort((a, b) => b.avgSentiment - a.avgSentiment);
      case "rank":
        return sorted.sort((a, b) => {
          if (a.avgRank === null) return 1;
          if (b.avgRank === null) return -1;
          if (a.avgRank === b.avgRank) {
            return b.appearances - a.appearances;
          }
          return a.avgRank - b.avgRank;
        });
      default:
        return sorted;
    }
  }, [competitors, competitorSort]);

  if (competitors.length === 0) return null;

  return (
    <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Competitors</h1>
          <p className="text-xs text-muted-foreground">
            See how your competitors perform
          </p>
        </div>

        {/* Brand Highlight */}
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
          <span className="font-medium text-foreground">
            {brandName}
          </span>
          <span className="rounded-full bg-background px-2 py-0.5 font-semibold shadow-sm">
            {brandSentiment}
          </span>
        </div>
      </div>

      {/* Segmented Filter */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 bg-muted p-1 dark:border-gray-700">
          {[
            { key: "rank", label: "Rank" },
            { key: "sentiment", label: "Sentiment" },
            { key: "appearances", label: "Mentions" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setCompetitorSort(item.key as any)}
              className={`
                px-4 py-1.5 text-xs font-medium rounded-md transition-all
                ${
                  competitorSort === item.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Competitor List */}
      <div className="mt-5 space-y-3">
        {sortedCompetitors.slice(0, 5).map((comp, idx) => {
          return (
            <div
              key={comp.name}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-3 dark:border-gray-800"
            >
              {/* Ranking */}
              <div className="w-10 shrink-0 text-sm font-semibold text-muted-foreground">
                #{idx + 1}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {comp.name}
                  </p>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                  
                  {/* Sentiment Pill */}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                    {comp.avgSentiment} sentiment
                  </span>

                  {/* Mentions */}
                  <span className="text-muted-foreground">
                    {comp.appearances} mentions
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}