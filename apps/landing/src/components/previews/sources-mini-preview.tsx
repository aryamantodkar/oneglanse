"use client";

import { Card, SentimentMetricCell } from "@oneglanse/ui";
import { getFaviconUrls, getModelFavicon } from "@oneglanse/utils";
import { BarChart3, FileText, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PREVIEW_CITATION_ROWS,
  PREVIEW_SOURCE_GROUPS,
  PREVIEW_TOTAL_CITATIONS,
} from "@/lib/preview-data";

type SourcesTab = "sources" | "citations";

export function SourcesMiniPreview(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SourcesTab>("sources");

  const sourceMetrics = useMemo(() => {
    const totalDomains = PREVIEW_SOURCE_GROUPS.length;
    const totalUrls = PREVIEW_SOURCE_GROUPS.reduce((sum, row) => sum + row.urls, 0);
    const avgMentionsPerDomain = Math.round(
      PREVIEW_SOURCE_GROUPS.reduce((sum, row) => sum + row.brandMentions, 0) / totalDomains,
    );

    return {
      totalDomains,
      totalUrls,
      totalCitations: PREVIEW_TOTAL_CITATIONS,
      avgMentionsPerDomain,
    };
  }, []);

  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Sources Intelligence
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Same information architecture as the dashboard sources page.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-black">
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              activeTab === "sources"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black"
                : "text-muted-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              Sources
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("citations")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              activeTab === "citations"
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black"
                : "text-muted-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Citations
            </span>
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricBadge label="Domains" value={sourceMetrics.totalDomains} />
        <MetricBadge label="URLs" value={sourceMetrics.totalUrls} />
        <MetricBadge label="Citations" value={sourceMetrics.totalCitations} />
        <MetricBadge label="Avg Mentions" value={sourceMetrics.avgMentionsPerDomain} />
      </div>

      {activeTab === "sources" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr_0.55fr_0.7fr] border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:border-gray-800 dark:bg-neutral-950">
              <span>Domain</span>
              <span className="text-right">Citations</span>
              <span className="text-right">Share</span>
              <span className="text-right">Traffic</span>
              <span className="text-right">URLs</span>
              <span className="text-right">Mentions</span>
              <span className="text-right">Models</span>
            </div>
            <div>
              {PREVIEW_SOURCE_GROUPS.map((group) => (
                <div
                  key={group.domain}
                  className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr_0.55fr_0.7fr] items-center border-b border-gray-100 px-3 py-2.5 text-xs last:border-0 dark:border-gray-800"
                >
                  <span className="inline-flex items-center gap-2 truncate font-medium text-gray-900 dark:text-gray-100">
                    <img
                      src={getFaviconUrls(group.domain)[0] ?? ""}
                      alt=""
                      className="h-4 w-4 rounded-sm"
                    />
                    {group.domain}
                  </span>
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {group.citations}
                  </span>
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {group.share.toFixed(1)}%
                  </span>
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {group.trafficShare.toFixed(1)}%
                  </span>
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {group.urls}
                  </span>
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {group.brandMentions}
                  </span>
                  <span className="flex justify-end gap-1">
                    {group.providers.slice(0, 3).map((provider) => (
                      <img
                        key={`${group.domain}-${provider}`}
                        src={getModelFavicon(provider)}
                        alt={provider}
                        className="h-4 w-4 rounded-sm"
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.55fr_0.55fr_0.6fr] border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:border-gray-800 dark:bg-neutral-950">
              <span>Citation</span>
              <span>Domain</span>
              <span className="text-right">Provider</span>
              <span className="text-right">Count</span>
              <span className="text-right">Sentiment</span>
            </div>
            {PREVIEW_CITATION_ROWS.map((row) => (
              <div
                key={`${row.domain}-${row.title}`}
                className="grid grid-cols-[1.5fr_0.8fr_0.55fr_0.55fr_0.6fr] items-start border-b border-gray-100 px-3 py-3 text-xs last:border-0 dark:border-gray-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {row.excerpt}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <img src={getFaviconUrls(row.domain)[0] ?? ""} alt="" className="h-4 w-4 rounded-sm" />
                  {row.domain}
                </span>
                <span className="flex items-center justify-end gap-2 text-gray-700 dark:text-gray-300">
                  <img
                    src={getModelFavicon(row.provider)}
                    alt={row.provider}
                    className="h-4 w-4 rounded-sm"
                  />
                  <span className="truncate">{row.provider}</span>
                </span>
                <span className="text-right font-medium text-gray-900 dark:text-gray-100">
                  {row.citations}x
                </span>
                <span className="flex justify-end">
                  <SentimentMetricCell sentiment={row.sentiment} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Traffic share reflects weighted referral volume from sampled citation domains.
      </p>
    </Card>
  );
}

function MetricBadge({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-black">
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}
