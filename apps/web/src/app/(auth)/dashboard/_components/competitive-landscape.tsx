import { useMemo, useState } from "react";
import { Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@onescope/ui";
import type { CompetitorData } from "../_utils/types";
import { getFaviconUrls } from "@onescope/utils";
import { Users } from "lucide-react";

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
  modelFilter,
}: {
  competitors: CompetitorData[];
  modelFilter: string;
}) {
  const [competitorSort, setCompetitorSort] =
    useState<"appearances" | "sentiment" | "rank">("rank");

  const displayCompetitors = useMemo(() => {
    const sorted = [...competitors];
    switch (competitorSort) {
      case "appearances":
        sorted.sort((a, b) => b.appearances - a.appearances);
        break;
      case "sentiment":
        sorted.sort((a, b) => b.avgSentiment - a.avgSentiment);
        break;
      case "rank":
        sorted.sort((a, b) => {
          if (a.avgRank === null) return 1;
          if (b.avgRank === null) return -1;
          if (a.avgRank === b.avgRank) {
            return b.appearances - a.appearances;
          }
          return a.avgRank - b.avgRank;
        });
        break;
    }

    // Take top 5, but ensure brand is always visible
    const top5 = sorted.slice(0, 5);
    const brandInTop5 = top5.some((c) => c.isBrand);
    if (!brandInTop5) {
      const brandEntry = sorted.find((c) => c.isBrand);
      if (brandEntry) {
        top5[4] = brandEntry;
      }
    }

    return top5;
  }, [competitors, competitorSort]);

  return (
    <Card className="flex h-full min-h-[500px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
            Competitors
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            See how you stack up against competitors.
          </p>
        </div>

        {/* Sort Filter */}
        <Select value={competitorSort} onValueChange={(v) => setCompetitorSort(v as any)}>
          <SelectTrigger className="h-9 w-32 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">Rank</SelectItem>
            <SelectItem value="sentiment">Sentiment</SelectItem>
            <SelectItem value="appearances">Mentions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Competitor List */}
      {competitors.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No competitor data available</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-around">
          {displayCompetitors.map((comp) => {
			const faviconUrls = getFaviconUrls(comp?.domain ?? "");
			const isBrand = comp.isBrand === true;

			return (
				<div
				key={comp.name}
				className={`ui-list-item group flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
					isBrand
					? "border-l-2 border-l-blue-500 border-y-gray-200 border-r-gray-200 bg-blue-50/60 dark:border-y-gray-800 dark:border-r-gray-800 dark:bg-blue-950/30"
					: "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
				}`}
				>
				{/* LEFT — Icon + Name + Secondary metrics */}
				<div className="min-w-0 flex-1 flex flex-col">
					{/* Row 1 → Icon + Name + You pill */}
					<div className="flex items-center gap-2 min-w-0">
					{faviconUrls[0] && (
						<img
						src={faviconUrls[0]}
						alt=""
						className="h-5 w-5 shrink-0 rounded-md object-contain transition-transform duration-200 group-hover:scale-105"
						onError={(e) =>
							((e.target as HTMLImageElement).style.display = "none")
						}
						/>
					)}

					<p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
						{comp.name}
					</p>

					{isBrand && (
						<span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
						You
						</span>
					)}
					</div>
				</div>

				{/* RIGHT — Primary metric (the one being sorted by) */}
				<div className="shrink-0">
					{competitorSort === "rank" && comp.avgRank !== null && (
					<div className="flex items-center gap-1 text-sm">
						{modelFilter === "All Models" && (
						<span className="text-[10px] font-medium text-muted-foreground">AVG</span>
						)}
						<span className="font-semibold text-gray-900 dark:text-gray-100">
						#{comp.avgRank}
						</span>
					</div>
					)}
					{competitorSort === "sentiment" && (
					<SentimentBadge value={comp.avgSentiment} />
					)}
					{competitorSort === "appearances" && (
					<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
						{comp.appearances}
					</span>
					)}
				</div>
				</div>
			  )
		  })}
        </div>
      )}

    </Card>
  );
}
