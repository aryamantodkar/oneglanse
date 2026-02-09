import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { Trophy, Users } from "lucide-react";
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

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'market_leader':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'top_contender':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'solid_option':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'niche_player':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'underdog':
      case 'not_positioned':
      case 'not_mentioned':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Competitive Position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position Badge */}
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-gray-500" />
          <span
            className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-semibold ${getPositionColor(
              position.current
            )}`}
          >
            {getPositionLabel(position.current)}
          </span>
        </div>

        {/* Share of Voice */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Share of Voice</span>
            <span className="text-sm font-semibold text-gray-900">
              {position.shareOfVoice}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gray-900"
              style={{ width: `${Math.min(position.shareOfVoice, 100)}%` }}
            />
          </div>
        </div>

        {/* Rank and Competitors */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Market Rank</div>
            <div className="text-2xl font-bold text-gray-900">
              {position.rank !== null ? `#${position.rank}` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Competitors</div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">
                {position.competitorCount}
              </span>
              <Users className="h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
