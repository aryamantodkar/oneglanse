"use client";

import { formatDate, formatMarkdown, getFaviconUrls, getModelFavicon } from "@oneglanse/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PositionMetricCell, SentimentMetricCell } from "../cell.js";

export type PromptResponsePreviewSource = {
  title: string;
  url: string;
};

export type PromptResponsePreviewRow = {
  id: string;
  modelProvider: string;
  promptRunAt: string;
  response: string;
  isAnalysed: boolean;
  metrics?: {
    geoScore: number;
    sentiment: number;
    visibility: number;
    position: number | null;
  };
  sources: PromptResponsePreviewSource[];
};

export function PromptResponsesPreview({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: PromptResponsePreviewRow[];
}): React.JSX.Element {
  const [expandedResponses, setExpandedResponses] = useState<Set<number>>(new Set());
  const toggleResponse = (index: number) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  return (
    <section aria-label="Prompt responses preview" className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-4">
        {rows.map((row, index) => {
          const isExpanded = expandedResponses.has(index);
          return (
            <div
              key={row.id}
              onClick={() => toggleResponse(index)}
              className={`group cursor-pointer rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 ease-out hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/20 ${
                isExpanded ? "shadow-lg ring-1 ring-gray-200 dark:ring-gray-700" : ""
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={getModelFavicon(row.modelProvider)}
                    alt={row.modelProvider}
                    className="h-6 w-6 rounded-md"
                  />

                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {row.modelProvider}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDate(row.promptRunAt)}
                    </span>
                  </div>
                </div>

                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : "rotate-0"
                  } group-hover:text-gray-600 dark:group-hover:text-gray-300`}
                />
              </div>

              {row.isAnalysed && row.metrics ? (
                <div className="mb-4 border-b border-gray-100 pb-3 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        GEO Score
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color:
                            row.metrics.geoScore >= 60
                              ? "#22c55e"
                              : row.metrics.geoScore >= 30
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      >
                        {row.metrics.geoScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Sentiment
                      </span>
                      <div className="text-xs">
                        <SentimentMetricCell sentiment={row.metrics.sentiment} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Visibility
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {row.metrics.visibility}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Position
                      </span>
                      <div className="text-xs">
                        {row.metrics.position !== null ? (
                          <PositionMetricCell position={row.metrics.position} />
                        ) : (
                          <span className="italic text-gray-400">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className={`prose prose-sm dark:prose-invert max-w-none transition-all duration-200 ${
                  isExpanded ? "" : "line-clamp-3 overflow-hidden"
                }`}
                dangerouslySetInnerHTML={{ __html: formatMarkdown(row.response) }}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleResponse(index);
                }}
                className="mt-3 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800 dark:hover:text-gray-200"
                type="button"
              >
                {isExpanded ? "Show less" : "View full response"}
              </button>

              {row.sources.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {row.sources.map((source) => (
                    <a
                      key={`${row.id}-${source.url}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-gray-700"
                    >
                      <img
                        src={getFaviconUrls(source.url)[0] ?? ""}
                        alt=""
                        className="h-3.5 w-3.5 rounded-sm"
                      />
                      <span className="truncate max-w-[180px]">{source.title}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
