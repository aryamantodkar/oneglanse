import type { AnalysisRecord } from "@onescope/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@onescope/ui";
import {
  formatDate,
  getDomain,
  getFaviconUrls,
  getModelFavicon,
  modelSelectors,
} from "@onescope/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { getGeoScoreColor, getSentimentColor } from "../_utils/helpers";
import {
  recTypeColors,
  recTypeLabels,
  priorityColors,
  severityStyles,
  defaultSeverityStyle,
} from "../_utils/constants";
import { PillTag } from "./stats-row";

export function RecordDetailDialog({
  record,
  open,
  onClose,
}: {
  record: AnalysisRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!record || !record.brand_analysis) return null;

  const ba = record.brand_analysis;
  const geoColor = getGeoScoreColor(ba.geoScore.overall);
  const sentimentColor = getSentimentColor(ba.sentiment.score);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-gray-200 bg-card p-6 shadow-lg dark:border-gray-800">

        {/* Header */}
        <DialogHeader>
          <p className="text-xs text-muted-foreground">
            Prompt Detail
          </p>

          <DialogTitle className="text-lg font-semibold leading-snug">
            {record.prompt}
          </DialogTitle>

          <DialogDescription>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700">
                <img
                  src={getModelFavicon(record.model_provider)}
                  alt={record.model_provider}
                  className="h-4 w-4 rounded-sm"
                />
                {modelSelectors.find(
                  (m) => m.value === record.model_provider
                )?.label || record.model_provider}
              </span>

              <span>•</span>

              <span>
                {formatDate(record.prompt_run_at)}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "GEO Score",
                value: ba.geoScore.overall,
                color: geoColor,
              },
              {
                label: "Rank",
                value:
                  ba.position.rankPosition !== null
                    ? `#${ba.position.rankPosition}`
                    : "—",
              },
              {
                label: "Sentiment",
                value: ba.sentiment.score,
                color: sentimentColor.text,
              },
              {
                label: "Visibility",
                value: `${ba.presence.visibility}%`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              >
                <p className="text-xs text-muted-foreground">
                  {item.label}
                </p>
                <p
                  className="mt-1 text-lg font-semibold"
                  style={
                    item.color && !item.color.includes("text-")
                      ? { color: item.color }
                      : undefined
                  }
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-xs text-muted-foreground">
              Verdict
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {ba.geoScore.verdict}
            </p>
          </div>

          {/* Recommendation */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3 dark:border-gray-800">
            <p className="text-xs text-muted-foreground">
              Recommendation
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${recTypeColors[ba.recommendation.type] ?? ""}`}
              >
                {recTypeLabels[ba.recommendation.type] ??
                  ba.recommendation.type}
              </span>

              {ba.recommendation.bestFor.map((tag) => (
                <PillTag key={tag} label={tag} />
              ))}
            </div>

            {ba.recommendation.caveats.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {ba.recommendation.caveats.map((c) => (
                  <p key={c}>{c}</p>
                ))}
              </div>
            )}
          </div>

          {/* Sentiment Breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-xs text-muted-foreground">
                Positives
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {ba.sentiment.positives.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-xs text-muted-foreground">
                Negatives
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {ba.sentiment.negatives.map((n) => (
                  <li key={n} className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Competitors */}
          {ba.competitors.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-xs text-muted-foreground mb-3">
                Competitors
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {ba.competitors.map((comp) => (
                  <div
                    key={comp.name}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {comp.name}
                      </span>
                      {comp.rankPosition !== null && (
                        <span className="text-xs text-muted-foreground">
                          #{comp.rankPosition}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${getSentimentColor(comp.sentiment).text}`}
                    >
                      {comp.sentiment}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {record.sources.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-xs text-muted-foreground mb-3">
                Sources
              </p>

              <div className="flex flex-wrap gap-2">
                {record.sources.map((source, i) => {
                  const favicon =
                    source.favicon ||
                    getFaviconUrls(source.url, "")[0];

                  return (
                    <a
                      key={`${source.url}-${i}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1 text-xs dark:border-gray-700"
                    >
                      {favicon && (
                        <img
                          src={favicon}
                          alt=""
                          className="h-3.5 w-3.5 rounded-sm"
                        />
                      )}
                      <span className="truncate max-w-[180px]">
                        {source.title || getDomain(source.url)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}