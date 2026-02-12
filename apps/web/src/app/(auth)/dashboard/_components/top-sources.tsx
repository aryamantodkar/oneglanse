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
		  <h1 className="text-lg font-semibold leading-none tracking-tight">
			Top Sources
		  </h1>
		  <p className="mt-3 text-xs text-muted-foreground">
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
				  className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 px-3 py-3 dark:border-gray-800"
				>
				  {/* LEFT SIDE (Rank + Content) */}
				  <div className="flex items-start gap-3 min-w-0 flex-1">
			  
					{/* Ranking */}
					<div className="w-5 shrink-0 text-xs text-muted-foreground">
					  #{idx + 1}
					</div>
			  
					{/* Icon + Content */}
					<div className="flex items-start gap-3 min-w-0 flex-1">
			  
					  {/* Icon Column */}
					  <div className="w-9 h-9 flex items-center justify-center rounded-md bg-muted shrink-0">
						{faviconUrl && (
						  <img
							src={faviconUrl}
							alt=""
							className="h-5 w-5 object-contain"
							onError={(e) => {
							  (e.target as HTMLImageElement).style.visibility = "hidden";
							}}
						  />
						)}
					  </div>
			  
					  {/* Content Column */}
					  <div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium leading-tight">
						  {source.domain}
						</p>
			  
						<div className="mt-1 text-xs text-muted-foreground">
						  {source.citationCount} citations
						</div>
			  
						{/* Usage Bar */}
						<div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
						  <div
							className="h-full rounded-full bg-slate-900 dark:bg-white transition-all"
							style={{ width: `${usagePercent}%` }}
						  />
						</div>
					  </div>
					</div>
				  </div>
			  
				  {/* RIGHT SIDE (Percentage) */}
				  <div className="w-10 shrink-0 text-right text-xs font-semibold text-muted-foreground">
					{usagePercent}%
				  </div>
				</div>
			  );
		  })}
		</div>
	  </Card>
	);
  }