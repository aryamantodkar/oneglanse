"use client";

import { Card } from "@oneglanse/ui";
import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Bot } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PREVIEW_BRAND,
  PREVIEW_COMPETITORS,
  PREVIEW_HERO_METRICS,
} from "@/lib/preview-data";

export function DashboardBrowserPreview(): React.JSX.Element {
  const [selectedModel, setSelectedModel] = useState("All Models");
  const topCompetitor = useMemo(() => {
    return PREVIEW_COMPETITORS.find((entry) => !entry.isBrand)?.name ?? "N/A";
  }, []);

  return (
    <Card className="gap-4 rounded-2xl border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Live Workspace Snapshot
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700">
          {selectedModel === "All Models" ? (
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <img
              src={getModelFavicon(selectedModel)}
              alt=""
              className="h-3.5 w-3.5 rounded-sm"
            />
          )}
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="max-w-28 bg-transparent text-xs outline-none sm:max-w-none"
            aria-label="Preview model selector"
          >
            {modelSelectors.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {PREVIEW_HERO_METRICS.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-black"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {metric.value}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Brand</p>
          <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{PREVIEW_BRAND.name}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Top Competitor</p>
          <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{topCompetitor}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Recommendation Rate</p>
          <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-300">65.5%</p>
        </div>
      </div>
    </Card>
  );
}
