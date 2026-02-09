import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { StrategicOpportunities } from "../_lib/types";

interface StrategicOpportunitiesCardProps {
  opportunities: StrategicOpportunities;
}

export function StrategicOpportunitiesCard({ opportunities }: StrategicOpportunitiesCardProps) {
  const hasOpportunities = opportunities.totalOpportunities > 0;

  return (
    <Card className="rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-900">Strategic Opportunities</CardTitle>
          {hasOpportunities && (
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {opportunities.totalOpportunities}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasOpportunities ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No opportunities identified</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Messaging */}
            {opportunities.messagingOpportunities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-1 rounded-full bg-blue-500" />
                  <div className="text-xs text-gray-600 font-medium">Messaging</div>
                </div>
                <div className="space-y-2 pl-3">
                  {opportunities.messagingOpportunities.slice(0, 2).map((opp, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-blue-600 text-xs mt-0.5">•</span>
                      <span className="text-xs text-gray-900 leading-relaxed">{opp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Gaps */}
            {opportunities.contentGaps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-1 rounded-full bg-purple-500" />
                  <div className="text-xs text-gray-600 font-medium">Content Gaps</div>
                </div>
                <div className="space-y-2 pl-3">
                  {opportunities.contentGaps.slice(0, 2).map((gap, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-purple-600 text-xs mt-0.5">•</span>
                      <span className="text-xs text-gray-900 leading-relaxed">{gap}</span>
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
