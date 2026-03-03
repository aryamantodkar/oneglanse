import { SentimentMetricCell, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@oneglanse/ui";
import { getFaviconUrls } from "@oneglanse/utils";
import { PREVIEW_COMPETITORS } from "@/lib/preview-data";

export function CompetitiveIntelligencePreview(): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800">
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Competitor
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Visibility
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mentions
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sentiment
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PREVIEW_COMPETITORS.map((row) => (
            <TableRow key={row.name} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
              <TableCell className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <img
                    src={getFaviconUrls(row.domain)[0] ?? ""}
                    alt=""
                    className="h-4 w-4 rounded-sm"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
                  {row.isBrand ? (
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground dark:border-gray-700">
                      Brand
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                {row.visibility ?? 0}%
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                {row.appearances}
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <span className="inline-flex justify-end">
                  <SentimentMetricCell sentiment={row.avgSentiment} />
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
