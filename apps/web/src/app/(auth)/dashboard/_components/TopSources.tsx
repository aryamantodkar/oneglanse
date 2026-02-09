import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import { ExternalLink } from "lucide-react";
import type { DomainSummary } from "../_lib/types";

interface TopSourcesProps {
  topDomains: DomainSummary[];
  workspaceId: string;
}

export function TopSources({ topDomains, workspaceId }: TopSourcesProps) {
  return (
    <Card className="rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-gray-700">Top Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {topDomains.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[10px] text-gray-500">No sources cited yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {topDomains.slice(0, 5).map((domain) => (
              <div
                key={domain.domain}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img
                    src={getFaviconUrls(domain.domain)[0]}
                    alt={domain.domain}
                    className="w-3 h-3 rounded flex-shrink-0"
                  />
                  <span className="text-xs text-gray-900 truncate">
                    {domain.domain}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-gray-600 flex-shrink-0 ml-2">
                  {domain.usagePercentage}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
