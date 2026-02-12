import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { getFaviconUrls } from "@onescope/utils";
import type { SourceData } from "../_utils/types";

export function TopSources({
	sources,
	totalRecords = 1,
  }: {
	sources: SourceData[];
	totalRecords?: number;
  }) {
	if (sources.length === 0) return null;
  
	return (
	  <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
		
		{/* Header */}
		<div>
		  <h1 className="text-sm font-semibold">
			Top Sources
		  </h1>
		  <p className="mt-1 text-xs text-muted-foreground">
			Where AI pulls your brand narrative most often.
		  </p>
		</div>
  
		{/* Source List */}
		<div className="mt-2 space-y-3">
		  {sources.slice(0, 5).map((source, idx) => {
			const faviconUrl =
			  source.favicon || getFaviconUrls(source.domain, "")[0];
  
			const usagePercent = Math.round(
			  (source.uniqueRecords.size / totalRecords) * 100
			);
  
			return (
			  <div
				key={source.domain}
				className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-3 dark:border-gray-800"
			  >
				{/* Light minimal ranking */}
				<div className="w-4 text-center text-xs text-muted-foreground">
				  {idx + 1}
				</div>
  
				{/* Content */}
				<div className="min-w-0 flex-1">
				  <div className="flex items-center gap-2">
					{faviconUrl && (
					  <img
						src={faviconUrl}
						alt=""
						className="h-4 w-4 shrink-0 rounded-sm"
						onError={(e) => {
						  (e.target as HTMLImageElement).style.display = "none";
						}}
					  />
					)}
					<p className="truncate text-sm font-medium">
					  {source.domain}
					</p>
				  </div>
  
				  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
					<span>{source.citationCount} citations</span>
				  </div>
  
				  {/* Subtle usage bar */}
				  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
					<div
					  className="h-full rounded-full bg-slate-900 dark:bg-white"
					  style={{ width: `${usagePercent}%` }}
					/>
				  </div>
				</div>
  
				{/* Right aligned percentage */}
				<div className="w-10 text-right text-xs font-semibold">
				  {usagePercent}%
				</div>
			  </div>
			);
		  })}
		</div>
	  </Card>
	);
  }