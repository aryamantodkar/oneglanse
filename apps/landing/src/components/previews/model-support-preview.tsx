"use client";

import { Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@oneglanse/ui";
import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Bot } from "lucide-react";
import { useMemo, useState } from "react";

const PROVIDER_METRICS = [
  { provider: "openai", runs: 8420, p95LatencyMs: 2210, passRate: 97.9 },
  { provider: "anthropic", runs: 6944, p95LatencyMs: 2480, passRate: 97.1 },
  { provider: "google", runs: 6012, p95LatencyMs: 2340, passRate: 96.8 },
  { provider: "perplexity", runs: 4278, p95LatencyMs: 2860, passRate: 95.6 },
  { provider: "google-ai-overview", runs: 1972, p95LatencyMs: 1910, passRate: 94.3 },
] as const;

function numberWithCommas(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ModelSupportPreview(): React.JSX.Element {
  const [modelFilter, setModelFilter] = useState<string>("All Models");

  const visibleRows = useMemo(() => {
    if (modelFilter === "All Models") return PROVIDER_METRICS;
    return PROVIDER_METRICS.filter((row) => row.provider === modelFilter);
  }, [modelFilter]);

  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Provider performance matrix
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Coverage, latency, and reliability by provider.
          </p>
        </div>
        <div className="w-full sm:w-52">
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="h-9 w-full rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-black">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {modelSelectors.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    {value === "All Models" ? (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <img src={getModelFavicon(value)} alt={value} className="h-4 w-4 rounded-sm" />
                    )}
                    <span>{label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:border-gray-800 dark:bg-neutral-950">
            <span>Provider</span>
            <span className="text-right">Prompt Runs</span>
            <span className="text-right">P95 Latency</span>
            <span className="text-right">Pass Rate</span>
          </div>
          {visibleRows.map((row) => (
            <div
              key={row.provider}
              className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] items-center border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-gray-800"
            >
              <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                <img src={getModelFavicon(row.provider)} alt={row.provider} className="h-4 w-4 rounded-sm" />
                {row.provider}
              </span>
              <span className="text-right text-gray-700 dark:text-gray-300">
                {numberWithCommas(row.runs)}
              </span>
              <span className="text-right text-gray-700 dark:text-gray-300">
                {row.p95LatencyMs}ms
              </span>
              <span className="text-right font-medium text-gray-900 dark:text-gray-100">
                {row.passRate.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
