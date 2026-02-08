import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { Bot, MessageSquare, Building2, Globe } from "lucide-react";

interface OverviewStatsProps {
  totalPrompts: number;
  totalResponses: number;
  trackedBrands: number;
  uniqueSources: number;
}

export function OverviewStats({
  totalPrompts,
  totalResponses,
  trackedBrands,
  uniqueSources,
}: OverviewStatsProps) {
  const stats = [
    {
      title: "Total Prompts",
      value: totalPrompts,
      subtitle: "Active prompts",
      icon: Bot,
    },
    {
      title: "Total Responses",
      value: totalResponses,
      subtitle: "Across all models",
      icon: MessageSquare,
    },
    {
      title: "Tracked Brands",
      value: trackedBrands,
      subtitle: "Being monitored",
      icon: Building2,
    },
    {
      title: "Unique Sources",
      value: uniqueSources,
      subtitle: "Citation domains",
      icon: Globe,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {stats.map((stat) => (
        <Card key={stat.title} className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stat.value}</div>
            <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
