import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { BrandHealthScore } from "../_lib/types";

interface BrandHealthCardProps {
  score: BrandHealthScore;
}

export function BrandHealthCard({ score }: BrandHealthCardProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return "text-green-600";
    if (value >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (value: number) => {
    if (value >= 80) return "bg-green-100";
    if (value >= 60) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getTrendIcon = () => {
    switch (score.trend) {
      case 'up':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendText = () => {
    switch (score.trend) {
      case 'up':
        return "Trending up";
      case 'down':
        return "Trending down";
      default:
        return "Stable";
    }
  };

  // Calculate progress for circular indicator
  const circumference = 2 * Math.PI * 70; // radius = 70
  const strokeDashoffset = circumference - (score.score / 100) * circumference;

  return (
    <Card className="rounded-xl shadow-sm col-span-full">
      <CardHeader>
        <CardTitle>Brand Health Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left: Circular Progress */}
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48">
              <svg className="transform -rotate-90 w-48 h-48">
                {/* Background circle */}
                <circle
                  cx="96"
                  cy="96"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="96"
                  cy="96"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={
                    score.score >= 80
                      ? "text-green-600"
                      : score.score >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  }
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreColor(score.score)}`}>
                  {score.score}
                </span>
                <span className="text-sm text-gray-500">out of 100</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              {getTrendIcon()}
              <span className="text-sm font-medium text-gray-700">{getTrendText()}</span>
            </div>
          </div>

          {/* Right: Breakdown */}
          <div className="flex-1 w-full">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Score Breakdown</h4>
            <div className="space-y-4">
              {/* Visibility */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Visibility</span>
                  <span className={`text-sm font-semibold ${getScoreColor(score.visibility)}`}>
                    {score.visibility}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      score.visibility >= 80
                        ? "bg-green-600"
                        : score.visibility >= 60
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${score.visibility}%` }}
                  />
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Sentiment</span>
                  <span className={`text-sm font-semibold ${getScoreColor(score.sentiment)}`}>
                    {score.sentiment}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      score.sentiment >= 80
                        ? "bg-green-600"
                        : score.sentiment >= 60
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${score.sentiment}%` }}
                  />
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Recommendation</span>
                  <span className={`text-sm font-semibold ${getScoreColor(score.recommendation)}`}>
                    {score.recommendation}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      score.recommendation >= 80
                        ? "bg-green-600"
                        : score.recommendation >= 60
                        ? "bg-yellow-600"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${score.recommendation}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Weighted composite: 40% visibility, 30% sentiment, 30% recommendation
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
