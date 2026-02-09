import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { SentimentInsights } from "../_lib/types";

interface SentimentInsightsCardProps {
  insights: SentimentInsights;
}

export function SentimentInsightsCard({ insights }: SentimentInsightsCardProps) {
  return (
    <Card className="rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">Sentiment Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1 w-1 rounded-full bg-green-500" />
              <div className="text-xs text-gray-600 font-medium">Strengths</div>
            </div>
            {insights.topStrengths.length === 0 ? (
              <p className="text-xs text-gray-400 italic pl-3">None identified</p>
            ) : (
              <div className="space-y-2 pl-3">
                {insights.topStrengths.slice(0, 2).map((strength, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-green-600 text-xs mt-0.5">•</span>
                    <span className="text-xs text-gray-900 leading-relaxed">{strength}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weaknesses */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1 w-1 rounded-full bg-red-500" />
              <div className="text-xs text-gray-600 font-medium">Weaknesses</div>
            </div>
            {insights.topWeaknesses.length === 0 ? (
              <p className="text-xs text-gray-400 italic pl-3">None identified</p>
            ) : (
              <div className="space-y-2 pl-3">
                {insights.topWeaknesses.slice(0, 2).map((weakness, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-red-600 text-xs mt-0.5">•</span>
                    <span className="text-xs text-gray-900 leading-relaxed">{weakness}</span>
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
