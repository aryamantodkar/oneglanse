import { Card, CardContent, CardHeader, CardTitle, Button } from "@onescope/ui";
import { formatDate } from "@onescope/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { PromptWithCount } from "../_lib/types";

interface RecentActivityProps {
  recentPrompts: PromptWithCount[];
  workspaceId: string;
}

export function RecentActivity({ recentPrompts, workspaceId }: RecentActivityProps) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recentPrompts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No prompts yet. Create your first prompt to get started.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              {recentPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex flex-col space-y-1 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {prompt.prompt.length > 60
                      ? `${prompt.prompt.slice(0, 60)}...`
                      : prompt.prompt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatDate(prompt.created_at)}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {prompt.responseCount} {prompt.responseCount === 1 ? "response" : "responses"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href={`/prompts?workspace=${workspaceId}`}>
              <Button variant="outline" className="w-full mt-4">
                View All Prompts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
