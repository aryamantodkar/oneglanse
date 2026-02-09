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
    <Card className="rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-gray-700">Competitive Position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Position */}
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">Position</span>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            {getPositionLabel(position.current)}
          </p>
        </div>

        {/* Share of Voice */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Share of Voice</span>
            <span className="text-xs font-semibold text-gray-900">{position.shareOfVoice}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-gray-900"
              style={{ width: `${Math.min(position.shareOfVoice, 100)}%` }}
            />
          </div>
        </div>

        {/* Rank and Competitors */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Rank</div>
            <div className="text-lg font-bold text-gray-900">
              {position.rank !== null ? `#${position.rank}` : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Competitors</div>
            <div className="text-lg font-bold text-gray-900">
              {position.competitorCount}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
