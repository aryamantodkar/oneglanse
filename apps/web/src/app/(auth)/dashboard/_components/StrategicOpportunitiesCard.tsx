import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { StrategicOpportunities } from "../_lib/types";

interface StrategicOpportunitiesCardProps {
  opportunities: StrategicOpportunities;
}

export function StrategicOpportunitiesCard({ opportunities }: StrategicOpportunitiesCardProps) {
  const hasOpportunities = opportunities.totalOpportunities > 0;

  return (
    <Card className="rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-gray-700">Strategic Opportunities</CardTitle>
          {hasOpportunities && (
            <span className="text-[10px] font-medium text-gray-500">
              {opportunities.totalOpportunities}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasOpportunities ? (
          <div className="text-center py-4">
            <p className="text-[10px] text-gray-500">No opportunities identified</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Messaging */}
            {opportunities.messagingOpportunities.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Messaging</div>
                <div className="space-y-1">
                  {opportunities.messagingOpportunities.slice(0, 2).map((opp, index) => (
                    <div key={index} className="text-xs text-gray-900">
                      • {opp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Gaps */}
            {opportunities.contentGaps.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Content Gaps</div>
                <div className="space-y-1">
                  {opportunities.contentGaps.slice(0, 2).map((gap, index) => (
                    <div key={index} className="text-xs text-gray-900">
                      • {gap}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
