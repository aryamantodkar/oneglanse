import { SentimentMetricCell, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@oneglanse/ui";
import { getFaviconUrls } from "@oneglanse/utils";
import { PREVIEW_COMPETITORS } from "@/lib/preview-data";

function recommendationRate(recCount: number, appearances: number): number {
  if (appearances <= 0) return 0;
  return Math.round((recCount / appearances) * 100);
}

export function AiVisibilityPreview(): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200 dark:border-gray-800">
            <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Brand
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Visibility
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended
            </TableHead>
            <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Avg Rank
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
                  <img src={getFaviconUrls(row.domain)[0] ?? ""} alt="" className="h-4 w-4 rounded-sm" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                {row.visibility ?? 0}%
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                {recommendationRate(row.recCount, row.appearances)}%
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                {row.avgRank?.toFixed(1) ?? "-"}
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
