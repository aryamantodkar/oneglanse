import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { AlertTriangle } from "lucide-react";
import type { CompetitiveThreat } from "../_lib/types";

interface CompetitiveThreatsCardProps {
  threats: CompetitiveThreat[];
}

export function CompetitiveThreatsCard({ threats }: CompetitiveThreatsCardProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Competitive Threats</CardTitle>
      </CardHeader>
      <CardContent>
        {threats.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No competitive threats identified</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threats.map((threat, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <h4 className="font-semibold text-gray-900">{threat.competitor}</h4>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                    {threat.winCount} {threat.winCount === 1 ? 'win' : 'wins'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                  <span>{threat.totalMentions} mentions</span>
                </div>

                {threat.threats.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">Key Advantages:</div>
                    <div className="flex flex-wrap gap-1">
                      {threat.threats.slice(0, 3).map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                        >
                          {item}
                        </span>
                      ))}
                      {threat.threats.length > 3 && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">
                          +{threat.threats.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
