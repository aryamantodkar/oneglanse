import { Card, CardContent, CardHeader, CardTitle, Button } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { DomainSummary } from "../_lib/types";

interface TopSourcesProps {
  topDomains: DomainSummary[];
  workspaceId: string;
}

export function TopSources({ topDomains, workspaceId }: TopSourcesProps) {
  const getBadgeColor = (percentage: number) => {
    if (percentage > 50) return "bg-blue-100 text-blue-800 border-blue-300";
    if (percentage > 25) return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Top Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {topDomains.length === 0 ? (
          <div className="text-center py-8">
            <ExternalLink className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No sources cited yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {topDomains.map((domain) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <img
                      src={getFaviconUrls(domain.domain)[0]}
                      alt={domain.domain}
                      className="w-5 h-5 rounded flex-shrink-0"
                    />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {domain.domain}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${getBadgeColor(
                        domain.usagePercentage
                      )}`}
                    >
                      {domain.usagePercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href={`/sources?workspace=${workspaceId}`}>
              <Button variant="outline" className="w-full mt-5 rounded-lg">
                View All Sources
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
