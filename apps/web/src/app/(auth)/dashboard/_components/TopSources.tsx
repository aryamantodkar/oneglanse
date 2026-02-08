import { Card, CardContent, CardHeader, CardTitle, Button } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { DomainSummary } from "../_lib/types";

interface TopSourcesProps {
  topDomains: DomainSummary[];
  workspaceId: string;
}

export function TopSources({ topDomains, workspaceId }: TopSourcesProps) {
  const getBadgeColor = (percentage: number) => {
    if (percentage > 50) return "bg-blue-100 text-blue-700";
    if (percentage > 25) return "bg-gray-200 text-gray-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Top Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {topDomains.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No sources yet.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {topDomains.map((domain) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <img
                      src={getFaviconUrls(domain.domain)[0]}
                      alt={domain.domain}
                      className="w-4 h-4 rounded flex-shrink-0"
                    />
                    <span className="text-sm text-gray-900 truncate">
                      {domain.domain}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getBadgeColor(
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
              <Button variant="outline" className="w-full mt-4">
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
