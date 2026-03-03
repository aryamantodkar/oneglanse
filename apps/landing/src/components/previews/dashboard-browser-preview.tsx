import { AggregateStatsRow } from "@oneglanse/ui";
import { PREVIEW_AGGREGATE_STATS } from "@/lib/preview-data";

export function DashboardBrowserPreview(): React.JSX.Element {
  return (
    <div>
      <AggregateStatsRow
        presenceRate={PREVIEW_AGGREGATE_STATS.presenceRate}
        rank={PREVIEW_AGGREGATE_STATS.rank}
        topSource={PREVIEW_AGGREGATE_STATS.topSource}
        topCompetitor={PREVIEW_AGGREGATE_STATS.topCompetitor}
        topCompetitorDomain={PREVIEW_AGGREGATE_STATS.topCompetitorDomain}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-2"
      />
    </div>
  );
}
