import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { Lightbulb, MessageSquare, FileText } from "lucide-react";
import type { StrategicOpportunities } from "../_lib/types";

interface StrategicOpportunitiesCardProps {
  opportunities: StrategicOpportunities;
}

export function StrategicOpportunitiesCard({ opportunities }: StrategicOpportunitiesCardProps) {
  const hasOpportunities = opportunities.totalOpportunities > 0;

  return (
    <Card className="rounded-xl shadow-sm col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Strategic Opportunities</CardTitle>
          {hasOpportunities && (
            <span className="inline-flex items-center rounded-md bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              {opportunities.totalOpportunities} {opportunities.totalOpportunities === 1 ? 'opportunity' : 'opportunities'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasOpportunities ? (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No opportunities identified yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Messaging Opportunities */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-semibold text-gray-700">Messaging Opportunities</h4>
              </div>
              {opportunities.messagingOpportunities.length === 0 ? (
                <p className="text-sm text-gray-500 italic">None identified</p>
              ) : (
                <ul className="space-y-2">
                  {opportunities.messagingOpportunities.map((opp, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-blue-900 flex-1">{opp}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Content Gaps */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-purple-600" />
                <h4 className="text-sm font-semibold text-gray-700">Content Gaps</h4>
              </div>
              {opportunities.contentGaps.length === 0 ? (
                <p className="text-sm text-gray-500 italic">None identified</p>
              ) : (
                <ul className="space-y-2">
                  {opportunities.contentGaps.map((gap, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-purple-900 flex-1">{gap}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
