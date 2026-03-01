import { AggregateStatsRow, Card } from "@oneglanse/ui";
import { PREVIEW_AGGREGATE_STATS } from "@/lib/preview-data";

export function DashboardBrowserPreview(): React.JSX.Element {
  return (
    <Card className="rounded-2xl border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Dashboard Metrics Preview
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The same stat cards used in the dashboard, rendered with static preview data.
        </p>
      </div>

      <AggregateStatsRow
        presenceRate={PREVIEW_AGGREGATE_STATS.presenceRate}
        rank={PREVIEW_AGGREGATE_STATS.rank}
        topSource={PREVIEW_AGGREGATE_STATS.topSource}
        topCompetitor={PREVIEW_AGGREGATE_STATS.topCompetitor}
        topCompetitorDomain={PREVIEW_AGGREGATE_STATS.topCompetitorDomain}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-2"
      />
    </Card>
  );
}
