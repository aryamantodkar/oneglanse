import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@onescope/ui";
import { SentimentMetricCell, PositionMetricCell } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import type { BrandSummary } from "../_lib/types";

interface BrandPerformanceProps {
  brandSummaries: BrandSummary[];
}

export function BrandPerformance({ brandSummaries }: BrandPerformanceProps) {
  // Show top 5 brands
  const topBrands = brandSummaries.slice(0, 5);

  return (
    <Card className="rounded-xl shadow-sm col-span-full">
      <CardHeader>
        <CardTitle>Brand Performance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {topBrands.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No brand data available yet. Run prompts and analyze responses to see brand performance.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-center">Avg Mentions</TableHead>
                  <TableHead className="text-center">Avg Sentiment</TableHead>
                  <TableHead className="text-center">Avg Visibility</TableHead>
                  <TableHead className="text-center">Avg Position</TableHead>
                  <TableHead className="text-center">Citations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBrands.map((brand) => (
                  <TableRow key={brand.name} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <img
                          src={getFaviconUrls(brand.website)[0]}
                          alt={brand.name}
                          className="w-5 h-5 rounded"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {brand.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {brand.website}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700">
                        {brand.avgMentions}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <SentimentMetricCell sentiment={brand.avgSentiment} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700">
                        {brand.avgVisibility}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <PositionMetricCell position={brand.avgPosition} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-gray-600">
                        {brand.sourceCount}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
