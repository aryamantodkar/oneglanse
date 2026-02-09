import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import type { CompetitivePosition } from "../_lib/types";

interface CompetitivePositionCardProps {
  position: CompetitivePosition;
}

export function CompetitivePositionCard({ position }: CompetitivePositionCardProps) {
  const getPositionLabel = (pos: string) => {
    const labels: Record<string, string> = {
      'market_leader': 'Market Leader',
      'top_contender': 'Top Contender',
      'solid_option': 'Solid Option',
      'niche_player': 'Niche Player',
      'underdog': 'Underdog',
      'not_positioned': 'Not Positioned',
      'not_mentioned': 'Not Mentioned'
    };
    return labels[pos] || pos.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className="rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">Competitive Position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position */}
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-xs text-gray-600 font-medium">Position</span>
          <p className="text-base font-bold text-gray-900 mt-1">
            {getPositionLabel(position.current)}
          </p>
        </div>

        {/* Share of Voice */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs text-gray-600 font-medium">Share of Voice</span>
            <span className="text-sm font-bold text-gray-900">{position.shareOfVoice}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-gray-700 to-gray-900 transition-all duration-300"
              style={{ width: `${Math.min(position.shareOfVoice, 100)}%` }}
            />
          </div>
        </div>

        {/* Rank and Competitors */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 font-medium mb-1">Rank</div>
            <div className="text-2xl font-bold text-gray-900">
              {position.rank !== null ? `#${position.rank}` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 font-medium mb-1">Competitors</div>
            <div className="text-2xl font-bold text-gray-900">
              {position.competitorCount}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
