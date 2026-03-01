"use client";

import { Card } from "@oneglanse/ui";
import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Bot } from "lucide-react";
import { useMemo, useState } from "react";
import { PREVIEW_BRAND, PREVIEW_COMPETITORS, PREVIEW_HERO_METRICS } from "@/lib/preview-data";

export function DashboardBrowserPreview(): React.JSX.Element {
  const [selectedModel, setSelectedModel] = useState("All Models");
  const topCompetitor = useMemo(() => {
    return PREVIEW_COMPETITORS.find((entry) => !entry.isBrand)?.name ?? "N/A";
  }, []);

  return (
    <div className="rounded-[1.25rem] border border-gray-200/80 bg-white/90 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-950/90">
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/90 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">dashboard.oneglanse.com</span>
        </div>

        <div className="grid gap-3 bg-background p-4 md:grid-cols-[1.1fr_1fr]">
          <Card className="gap-3 rounded-2xl border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Model scope</p>
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700">
                {selectedModel === "All Models" ? (
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <img src={getModelFavicon(selectedModel)} alt="" className="h-3.5 w-3.5 rounded-sm" />
                )}
                <select
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className="bg-transparent text-xs outline-none"
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
                <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1.5 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{metric.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="gap-3 rounded-2xl border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Live summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                <span className="text-muted-foreground">Brand</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{PREVIEW_BRAND.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                <span className="text-muted-foreground">Top competitor</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{topCompetitor}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
                <span className="text-muted-foreground">Recommendation rate</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-300">68.5%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
