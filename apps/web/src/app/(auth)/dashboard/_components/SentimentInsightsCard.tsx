import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { SentimentInsights } from "../_lib/types";

interface SentimentInsightsCardProps {
  insights: SentimentInsights;
}

export function SentimentInsightsCard({ insights }: SentimentInsightsCardProps) {
  return (
    <Card className="rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-gray-700">Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Strengths */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Strengths</div>
            {insights.topStrengths.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">None identified</p>
            ) : (
              <div className="space-y-1">
                {insights.topStrengths.slice(0, 2).map((strength, index) => (
                  <div key={index} className="text-xs text-gray-900">
                    • {strength}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weaknesses */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Weaknesses</div>
            {insights.topWeaknesses.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">None identified</p>
            ) : (
              <div className="space-y-1">
                {insights.topWeaknesses.slice(0, 2).map((weakness, index) => (
                  <div key={index} className="text-xs text-gray-900">
                    • {weakness}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
