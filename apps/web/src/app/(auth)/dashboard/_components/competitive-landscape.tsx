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
}: {
  competitors: CompetitorData[];
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

  if (competitors.length === 0) return null;

  return (
    <Card className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">

      {/* Header */}
      <div>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Competitors
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          See how you stack up against competitors
        </p>
      </div>

      {/* Competitor List */}
      <div className="mt-4 space-y-2.5">
        {displayCompetitors.map((comp) => {
			const faviconUrls = getFaviconUrls(comp?.domain ?? "");
			const isBrand = comp.isBrand === true;

			return (
				<div
				key={comp.name}
				className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${
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
						className="h-5 w-5 rounded-md object-contain shrink-0"
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

					{/* Row 2 → Secondary metrics (the ones NOT being sorted by) */}
					<div className="mt-1.5 flex flex-wrap items-center gap-3">
					{competitorSort !== "sentiment" && (
						<SentimentBadge value={comp.avgSentiment} />
					)}
					{competitorSort !== "rank" && (
						<span className="text-xs text-muted-foreground">
						{comp.avgRank !== null ? `#${comp.avgRank} rank` : "— rank"}
						</span>
					)}
					{competitorSort !== "appearances" && (
						<span className="text-xs text-muted-foreground">
						{comp.appearances} mentions
						</span>
					)}
					</div>
				</div>

				{/* RIGHT — Primary metric (the one being sorted by) */}
				<div className="shrink-0">
					{competitorSort === "rank" && (
					<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
						{comp.avgRank !== null ? `#${comp.avgRank}` : "—"}
					</span>
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
