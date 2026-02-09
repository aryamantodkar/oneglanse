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
    <Card className="rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">Top Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {topDomains.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No sources cited yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topDomains.slice(0, 5).map((domain, index) => (
              <div
                key={domain.domain}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 flex-shrink-0">
                    <img
                      src={getFaviconUrls(domain.domain)[0]}
                      alt={domain.domain}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-900 truncate">
                    {domain.domain}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-gray-700 to-gray-900 h-1.5 rounded-full transition-all"
                      style={{ width: `${domain.usagePercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-8 text-right">
                    {domain.usagePercentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
