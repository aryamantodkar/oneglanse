import { useMemo, useState } from "react";
import { Card } from "@onescope/ui";
import type { CompetitorData } from "../_utils/types";
import { getFaviconUrls } from "@onescope/utils";

function SentimentBadge({ value }: { value: number }) {
  let bgClass = "";
  let dotClass = "";

  if (value >= 70) {
    bgClass =
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    dotClass = "bg-emerald-500";
  } else if (value >= 40) {
    bgClass =
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    dotClass = "bg-amber-500";
  } else {
    bgClass =
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    dotClass = "bg-rose-500";
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${bgClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {value}
    </div>
  );
}

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
    <Card className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Landscape
          </p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Competitors
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            See how your competitors perform
          </p>
        </div>

        {/* Brand Highlight with Subtle Sentiment */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {brandName}
            </span>
            <SentimentBadge value={brandSentiment} />
          </div>
        </div>
      </div>

      {/* Competitor List */}
      <div className="mt-4 space-y-2.5">
        {sortedCompetitors.slice(0, 5).map((comp, idx) => {
			const faviconUrls = getFaviconUrls(comp?.domain ?? "");

			return (
				<div
				key={comp.name}
				className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
				>
				{/* Ranking */}
				<div className="w-4 text-center text-[11px] font-semibold text-muted-foreground">
					{idx + 1}
				</div>

				{/* Content */}
				<div className="min-w-0 flex-1 flex flex-col">
					
					{/* Row 1 → Icon + Name */}
					<div className="flex items-center gap-2 min-w-0">
					{faviconUrls[0] && (
						<img
						src={faviconUrls[0]}
						alt=""
						className="h-5 w-5 rounded-md object-contain shrink-0"
						onError={(e) =>
							((e.target as HTMLImageElement).style.display = "none")
						}
						/>
					)}

					<p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
						{comp.name}
					</p>
					</div>

					{/* Row 2 → Sentiment + Mentions */}
					<div className="mt-2 flex flex-wrap items-center gap-3">
					<SentimentBadge value={comp.avgSentiment} />

					<span className="text-xs text-muted-foreground">
						{comp.appearances} mentions
					</span>
					</div>

				</div>
				</div>
			  )
		})}
      </div>

	    {/* Segmented Filter */}
		<div className="mt-3 flex justify-center">
			<div className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
			{[
				{ key: "rank", label: "Rank" },
				{ key: "sentiment", label: "Sentiment" },
				{ key: "appearances", label: "Mentions" },
			].map((item) => (
				<button
				key={item.key}
				onClick={() => setCompetitorSort(item.key as any)}
				className={`
					px-4 py-1.5 text-[11px] font-semibold rounded-full transition-all
					${
					competitorSort === item.key
						? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
						: "text-muted-foreground hover:text-foreground"
					}
				`}
				>
				{item.label}
				</button>
			))}
			</div>
		</div>
    </Card>
  );
}
