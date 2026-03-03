"use client";

import type { SourcePanelCitationDomain, SourcePanelDomainRow, SourcePanelMetrics } from "@oneglanse/ui";
import { SourcesIntelligencePanel } from "@oneglanse/ui";
import { useMemo } from "react";
import {
  PREVIEW_CITATION_ROWS,
  PREVIEW_SOURCE_GROUPS,
  PREVIEW_TOTAL_CITATIONS,
} from "@/lib/preview-data";

export function SourcesMiniPreview(): React.JSX.Element {
  const metrics = useMemo<SourcePanelMetrics>(() => {
    const totalUrls = PREVIEW_SOURCE_GROUPS.reduce((sum, row) => sum + row.urls, 0);
    const avgCitationsPerUrl = totalUrls > 0 ? (PREVIEW_TOTAL_CITATIONS / totalUrls).toFixed(1) : "0.0";
    return {
      totalDomains: PREVIEW_SOURCE_GROUPS.length,
      totalUrls,
      totalCitations: PREVIEW_TOTAL_CITATIONS,
      avgCitationsPerUrl,
      topDomain: PREVIEW_SOURCE_GROUPS[0]?.domain ?? "N/A",
      topDomainShare: PREVIEW_SOURCE_GROUPS[0]?.share ?? 0,
    };
  }, []);

  const domainRows = useMemo<SourcePanelDomainRow[]>(
    () =>
      PREVIEW_SOURCE_GROUPS.map((row) => ({
        domain: row.domain,
        share: row.share,
        totalCitations: row.citations,
        urlCount: row.urls,
        providers: [...row.providers],
      })),
    [],
  );

  const citationDomains = useMemo<SourcePanelCitationDomain[]>(
    () =>
      PREVIEW_CITATION_ROWS.map((row) => ({
        domain: row.domain,
        totalCitations: row.citations,
        urlCount: 1,
        providers: [row.provider],
        urls: [
          {
            url: `https://${row.domain}/reports/${row.title.toLowerCase().replaceAll(" ", "-")}`,
            title: row.title,
            totalCitations: row.citations,
            providers: [row.provider],
            excerpts: [{ modelProvider: row.provider, citedText: row.excerpt }],
          },
        ],
      })),
    [],
  );

  return (
    <SourcesIntelligencePanel
      metrics={metrics}
      domainRows={domainRows}
      citationDomains={citationDomains}
      enableDomainSorting={false}
      containerVariant="card"
    />
  );
}
