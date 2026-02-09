import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { CompetitiveThreat } from "../_lib/types";

interface CompetitiveThreatsCardProps {
  threats: CompetitiveThreat[];
}

export function CompetitiveThreatsCard({ threats }: CompetitiveThreatsCardProps) {
  return (
    <Card className="rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-gray-700">Competitive Threats</CardTitle>
      </CardHeader>
      <CardContent>
        {threats.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[10px] text-gray-500">No threats identified</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threats.slice(0, 3).map((threat, index) => (
              <div key={index} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900">{threat.competitor}</span>
                  <span className="text-[10px] text-gray-500">{threat.totalMentions} mentions</span>
                </div>
                {threat.threats.length > 0 && (
                  <div className="text-[10px] text-gray-600">
                    {threat.threats.slice(0, 2).join(', ')}
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
