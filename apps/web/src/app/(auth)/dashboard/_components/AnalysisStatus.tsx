import { Card, CardContent, CardHeader, CardTitle, Button } from "@onescope/ui";
import { formatDate } from "@onescope/utils";
import { CheckCircle2, Clock, Play } from "lucide-react";
import type { AnalysisStatus as AnalysisStatusType } from "../_lib/types";

interface AnalysisStatusProps {
  status: AnalysisStatusType;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

export function AnalysisStatus({ status, onAnalyze, isAnalyzing = false }: AnalysisStatusProps) {
  const totalResponses = status.analyzed + status.pending;
  const progressPercentage = totalResponses > 0
    ? Math.round((status.analyzed / totalResponses) * 100)
    : 0;

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Analysis Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-gray-600">Analyzed</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {status.analyzed}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {status.pending}
            </span>
          </div>

          {status.lastRun && (
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">Last Analysis</span>
              <span className="text-xs text-gray-500">
                {formatDate(status.lastRun)}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {progressPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {status.pending > 0 && onAnalyze && (
            <Button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="w-full mt-2"
              variant="outline"
            >
              <Play className="mr-2 h-4 w-4" />
              {isAnalyzing ? "Analyzing..." : "Analyze Pending"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
