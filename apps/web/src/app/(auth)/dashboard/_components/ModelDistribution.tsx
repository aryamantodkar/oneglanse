import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { getModelFavicon } from "@onescope/utils";
import type { ModelStat } from "../_lib/types";

interface ModelDistributionProps {
  modelStats: ModelStat[];
}

export function ModelDistribution({ modelStats }: ModelDistributionProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Model Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {modelStats.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No responses yet.
          </p>
        ) : (
          <div className="space-y-4">
            {modelStats.map((stat) => (
              <div
                key={stat.model}
                className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div className="flex items-center space-x-3">
                  <img
                    src={getModelFavicon(stat.model)}
                    alt={stat.model}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {stat.model}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{stat.count} responses</span>
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {stat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
