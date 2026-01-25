"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { useSearchParams } from "next/navigation";

export default function Dashboard() {
  // const searchParams = useSearchParams();
  // const workspaceId = searchParams.get("workspace") ?? "";
  
  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Welcome back! Here’s a quick overview of your workspace.
        </p>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">24</p>
            <p className="text-sm text-gray-500">Total prompts saved</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">8</p>
            <p className="text-sm text-gray-500">Tracked sources</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Recent Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-gray-700">
              <li>“Generate ad copy for new product launch”</li>
              <li>“Summarize competitor’s marketing blog”</li>
              <li>“Track mentions of fitness trends in news”</li>
            </ul>
            <Button variant="outline" className="mt-4">
              View All
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Top Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-700">
              <li>🌐 fitnessdaily.com</li>
              <li>🌐 competitorfit.com</li>
              <li>🌐 healthtrends.io</li>
            </ul>
            <Button variant="outline" className="mt-4">
              Manage Sources
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}