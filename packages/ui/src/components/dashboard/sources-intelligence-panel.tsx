"use client";

import {
  cleanCitedText,
  cn,
  formatCitationLabel,
  getFaviconUrls,
  getModelFavicon,
  getUrlPath,
} from "@oneglanse/utils";
import { BarChart3, ChevronRight, ExternalLink, Globe2, Link2, SearchX } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useSortState } from "../../hooks/use-sort-state.js";
import { Card } from "../card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table.js";
import { SortableHeader } from "./sortable-header.js";

type SourcesTab = "domains" | "citations";
type SortColumn = "share" | "citations" | "urls";

export type SourcePanelMetrics = {
  totalDomains: number;
  totalUrls: number;
  totalCitations: number;
  avgCitationsPerUrl: string;
  topDomain: string;
  topDomainShare: number;
};

export type SourcePanelDomainRow = {
  domain: string;
  share: number;
  totalCitations: number;
  urlCount: number;
  providers: string[];
};

export type SourcePanelCitationExcerpt = {
  modelProvider?: string;
  citedText?: string;
};

export type SourcePanelCitationUrl = {
  url: string;
  title: string;
  totalCitations: number;
  providers: string[];
  excerpts: SourcePanelCitationExcerpt[];
};

export type SourcePanelCitationDomain = {
  domain: string;
  totalCitations: number;
  urlCount: number;
  providers: string[];
  urls: SourcePanelCitationUrl[];
};

function FaviconWithFallback({
  url,
  size = "md",
}: {
  url: string;
  size?: "sm" | "md";
}): React.JSX.Element {
  const [showFavicon, setShowFavicon] = useState(true);
  const favicon = getFaviconUrls(url, "")[0];
  const sizeClasses = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const iconSizeClasses = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (favicon && showFavicon) {
    return (
      <img
        src={favicon}
        alt=""
        className={`${sizeClasses} rounded-sm`}
        onError={() => setShowFavicon(false)}
      />
    );
  }

  return (
    <div className={`${sizeClasses} flex items-center justify-center rounded-sm bg-gray-100 dark:bg-gray-800`}>
      <Globe2 className={`${iconSizeClasses} text-gray-500 dark:text-gray-400`} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  badgeFavicon,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: typeof Globe2;
  badgeFavicon?: string | null;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {badgeFavicon ? <img src={badgeFavicon} alt="" className="h-3.5 w-3.5 rounded-sm" /> : null}
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function SourcesIntelligencePanel({
  metrics,
  domainRows,
  citationDomains,
  enableDomainSorting = false,
  containerVariant = "card",
  emptyTitle = "No source data for this filter",
  emptySubtitle = "Try another model filter to inspect source patterns.",
}: {
  metrics: SourcePanelMetrics;
  domainRows: SourcePanelDomainRow[];
  citationDomains: SourcePanelCitationDomain[];
  enableDomainSorting?: boolean;
  containerVariant?: "card" | "plain";
  emptyTitle?: string;
  emptySubtitle?: string;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SourcesTab>("domains");
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const { sortColumn, sortDirection, toggleSort } = useSortState<SortColumn>("citations", "desc");

  const hasData = domainRows.length > 0 || citationDomains.length > 0;

  const sortedDomainRows = useMemo(() => {
    if (!enableDomainSorting) return domainRows;

    const rows = [...domainRows];
    rows.sort((a, b) => {
      const aValue = sortColumn === "share" ? a.share : sortColumn === "urls" ? a.urlCount : a.totalCitations;
      const bValue = sortColumn === "share" ? b.share : sortColumn === "urls" ? b.urlCount : b.totalCitations;
      const diff = aValue - bValue;
      return sortDirection === "asc" ? diff : -diff;
    });
    return rows;
  }, [domainRows, enableDomainSorting, sortColumn, sortDirection]);

  const panelBody = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Globe2}
          label="Domains"
          value={String(metrics.totalDomains)}
          subtitle="Unique publishers tracked"
        />
        <MetricCard
          icon={Link2}
          label="URLs"
          value={String(metrics.totalUrls)}
          subtitle="Unique source pages captured"
        />
        <MetricCard
          icon={BarChart3}
          label="Citations"
          value={String(metrics.totalCitations)}
          subtitle={`Avg ${metrics.avgCitationsPerUrl} citations per URL`}
        />
        <MetricCard
          icon={BarChart3}
          label="Top Domain Share"
          value={`${metrics.topDomainShare}%`}
          subtitle={`${metrics.topDomain} share of citations`}
          badgeFavicon={getFaviconUrls(metrics.topDomain, "")[0] ?? null}
        />
      </div>

      <div className="mt-5 flex gap-3 border-b border-gray-200 dark:border-gray-800">
        <button
          className={cn(
            "px-3 py-2 text-sm font-semibold transition-colors",
            activeTab === "domains"
              ? "border-b-2 border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100"
              : "text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100",
          )}
          onClick={() => setActiveTab("domains")}
          type="button"
        >
          Domains
        </button>
        <button
          className={cn(
            "px-3 py-2 text-sm font-semibold transition-colors",
            activeTab === "citations"
              ? "border-b-2 border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100"
              : "text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100",
          )}
          onClick={() => setActiveTab("citations")}
          type="button"
        >
          Citations
        </button>
      </div>

      {!hasData ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-black">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <SearchX className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptySubtitle}</p>
        </div>
      ) : activeTab === "domains" ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-black">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-gray-800">
                <TableHead className="w-[56px] px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Publisher
                </TableHead>
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {enableDomainSorting ? (
                    <SortableHeader
                      column="share"
                      currentSort={sortColumn}
                      currentDirection={sortDirection}
                      onSort={toggleSort}
                    >
                      Share of Citations
                    </SortableHeader>
                  ) : (
                    "Share of Citations"
                  )}
                </TableHead>
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {enableDomainSorting ? (
                    <SortableHeader
                      column="citations"
                      currentSort={sortColumn}
                      currentDirection={sortDirection}
                      onSort={toggleSort}
                    >
                      Total Citations
                    </SortableHeader>
                  ) : (
                    "Total Citations"
                  )}
                </TableHead>
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {enableDomainSorting ? (
                    <SortableHeader
                      column="urls"
                      currentSort={sortColumn}
                      currentDirection={sortDirection}
                      onSort={toggleSort}
                    >
                      Unique URLs
                    </SortableHeader>
                  ) : (
                    "Unique URLs"
                  )}
                </TableHead>
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Providers
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDomainRows.map((domain, idx) => (
                <TableRow
                  key={domain.domain}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-neutral-900/60"
                >
                  <TableCell className="px-4 py-5 text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="px-4 py-5">
                    <div className="flex items-center gap-2">
                      <FaviconWithFallback url={domain.domain} />
                      <a
                        href={`https://${domain.domain}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-sm font-semibold text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
                      >
                        {domain.domain}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {domain.share.toFixed(1)}%
                  </TableCell>
                  <TableCell className="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">
                    {domain.totalCitations}
                  </TableCell>
                  <TableCell className="px-4 py-5 text-sm text-gray-700 dark:text-gray-200">
                    {domain.urlCount}
                  </TableCell>
                  <TableCell className="px-4 py-5">
                    <div className="flex items-center gap-1.5">
                      {domain.providers.map((provider) => (
                        <img
                          key={`${domain.domain}-${provider}`}
                          src={getModelFavicon(provider)}
                          alt={provider}
                          title={provider}
                          className="h-4 w-4 rounded-sm"
                        />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-black">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-gray-800">
                <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Source Reference
                </TableHead>
                <TableHead className="w-[300px] px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Citations & Providers
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {citationDomains.map((group) => {
                const domainOpen = openDomain === group.domain;
                return (
                  <Fragment key={group.domain}>
                    <TableRow
                      className="cursor-pointer border-b border-gray-100 bg-white hover:bg-gray-50/60 dark:border-gray-800 dark:bg-black dark:hover:bg-neutral-900/60"
                      onClick={() => setOpenDomain(domainOpen ? null : group.domain)}
                    >
                      <TableCell className="px-4 py-5">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${domainOpen ? "rotate-90" : ""}`}
                          />
                          <FaviconWithFallback url={group.domain} />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {group.domain}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5 text-right text-sm text-gray-700 dark:text-gray-200">
                        <span className="font-semibold">{formatCitationLabel(group.totalCitations)}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        {group.urlCount} URLs
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="inline-flex items-center gap-1.5 align-middle">
                          {group.providers.map((provider) => (
                            <img
                              key={`${group.domain}-${provider}`}
                              src={getModelFavicon(provider)}
                              alt={provider}
                              title={provider}
                              className="h-4 w-4 rounded-sm"
                            />
                          ))}
                        </span>
                      </TableCell>
                    </TableRow>

                    {domainOpen &&
                      group.urls.map((source) => {
                        const urlOpen = openUrl === source.url;
                        return (
                          <Fragment key={source.url}>
                            <TableRow
                              className="cursor-pointer border-b border-gray-100 bg-white hover:bg-gray-50/60 dark:border-gray-800 dark:bg-black dark:hover:bg-neutral-900/60"
                              onClick={() => setOpenUrl(urlOpen ? null : source.url)}
                            >
                              <TableCell className="px-4 py-5 pl-12">
                                <div className="flex items-start gap-2">
                                  <ChevronRight
                                    className={`mt-0.5 h-3.5 w-3.5 text-muted-foreground transition-transform ${urlOpen ? "rotate-90" : ""}`}
                                  />
                                  <div className="mt-0.5">
                                    <FaviconWithFallback url={source.url} size="sm" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {source.title || "Untitled source"}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-black dark:text-gray-300">
                                        {getUrlPath(source.url)}
                                      </span>
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-5 text-right text-sm text-gray-700 dark:text-gray-200">
                                <span className="font-semibold">{formatCitationLabel(source.totalCitations)}</span>
                                <span className="mx-2 text-gray-300">•</span>
                                <span className="inline-flex items-center gap-1.5 align-middle">
                                  {source.providers.map((provider) => (
                                    <img
                                      key={`${source.url}-${provider}`}
                                      src={getModelFavicon(provider)}
                                      alt={provider}
                                      title={provider}
                                      className="h-4 w-4 rounded-sm"
                                    />
                                  ))}
                                </span>
                              </TableCell>
                            </TableRow>

                            {urlOpen &&
                              source.excerpts.map((excerpt, idx) => (
                                <TableRow
                                  key={`${source.url}-${idx}`}
                                  className="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-black"
                                >
                                  <TableCell className="px-4 py-5 pl-20">
                                    <div className="max-w-full rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/60 p-4 dark:border-gray-800 dark:from-black dark:to-neutral-950">
                                      <p className="line-clamp-5 overflow-hidden text-sm font-medium leading-relaxed text-gray-900 [overflow-wrap:anywhere] break-words dark:text-gray-100">
                                        {excerpt.citedText?.trim()
                                          ? cleanCitedText(excerpt.citedText)
                                          : "This citation has no extracted quoted text."}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-5 text-right">
                                    {excerpt.modelProvider ? (
                                      <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-muted-foreground dark:border-gray-700 dark:bg-black">
                                        <img
                                          src={getModelFavicon(excerpt.modelProvider)}
                                          alt=""
                                          className="h-3.5 w-3.5 rounded-sm"
                                        />
                                        {excerpt.modelProvider}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Unknown model</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  if (containerVariant === "plain") {
    return panelBody;
  }

  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
      {panelBody}
    </Card>
  );
}
