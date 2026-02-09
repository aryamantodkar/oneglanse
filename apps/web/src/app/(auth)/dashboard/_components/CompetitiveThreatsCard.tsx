import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { CompetitiveThreat } from "../_lib/types";

interface CompetitiveThreatsCardProps {
  threats: CompetitiveThreat[];
}

export function CompetitiveThreatsCard({ threats }: CompetitiveThreatsCardProps) {
  return (
    <Card className="rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">Competitive Threats</CardTitle>
      </CardHeader>
      <CardContent>
        {threats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No threats identified</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threats.slice(0, 3).map((threat, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3 border-l-2 border-red-500/30">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">{threat.competitor}</span>
                  <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded-full">
                    {threat.totalMentions} mentions
                  </span>
                </div>
                {threat.threats.length > 0 && (
                  <div className="text-xs text-gray-700 leading-relaxed">
                    {threat.threats.slice(0, 2).join(' • ')}
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
