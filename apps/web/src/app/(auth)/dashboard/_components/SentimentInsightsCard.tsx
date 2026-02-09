import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { SentimentInsights } from "../_lib/types";

interface SentimentInsightsCardProps {
  insights: SentimentInsights;
}

export function SentimentInsightsCard({ insights }: SentimentInsightsCardProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Sentiment Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-green-600" />
              <h4 className="text-sm font-semibold text-gray-700">Top Strengths</h4>
            </div>
            {insights.topStrengths.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No strengths identified yet</p>
            ) : (
              <div className="space-y-2">
                {insights.topStrengths.map((strength, index) => (
                  <div
                    key={index}
                    className="bg-green-50 border border-green-200 rounded-lg p-3"
                  >
                    <p className="text-sm text-green-900">{strength}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weaknesses */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="h-4 w-4 text-red-600" />
              <h4 className="text-sm font-semibold text-gray-700">Top Weaknesses</h4>
            </div>
            {insights.topWeaknesses.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No weaknesses identified yet</p>
            ) : (
              <div className="space-y-2">
                {insights.topWeaknesses.map((weakness, index) => (
                  <div
                    key={index}
                    className="bg-red-50 border border-red-200 rounded-lg p-3"
                  >
                    <p className="text-sm text-red-900">{weakness}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Signal Counts */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {insights.positiveSignals.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Positive Signals</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {insights.negativeSignals.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Negative Signals</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
