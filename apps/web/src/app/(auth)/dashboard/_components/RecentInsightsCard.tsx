import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { TrendingUp, AlertTriangle, Lightbulb, TrendingDown } from "lucide-react";
import type { RecentInsight } from "../_lib/types";

interface RecentInsightsCardProps {
  insights: RecentInsight[];
}

export function RecentInsightsCard({ insights }: RecentInsightsCardProps) {
  const getIcon = (type: RecentInsight['type']) => {
    switch (type) {
      case 'strength':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'weakness':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4 text-blue-600" />;
      case 'threat':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getBgColor = (type: RecentInsight['type']) => {
    switch (type) {
      case 'strength':
        return 'bg-green-50 border-green-200';
      case 'weakness':
        return 'bg-red-50 border-red-200';
      case 'opportunity':
        return 'bg-blue-50 border-blue-200';
      case 'threat':
        return 'bg-orange-50 border-orange-200';
    }
  };

  const getLabel = (type: RecentInsight['type']) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card className="rounded-xl shadow-sm col-span-full">
      <CardHeader>
        <CardTitle>Recent Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No recent insights available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getBgColor(insight.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {getLabel(insight.type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{insight.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
