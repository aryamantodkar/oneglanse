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
	  <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-5 ">
		
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
					className="flex items-center justify-between gap-4 px-3 py-3"
					>
					{/* LEFT SIDE (Rank + Content) */}
					<div className="flex items-center gap-3 min-w-0 flex-1">
						{/* Icon + Content */}
						<div className="flex items-center gap-3 min-w-0 flex-1">

						{/* Icon */}
						{faviconUrl && (
							<img
							src={faviconUrl}
							alt=""
							className="h-5 w-5 rounded-md object-contain shrink-0"
							onError={(e) => {
								(e.target as HTMLImageElement).style.visibility = "hidden";
							}}
							/>
						)}

						{/* Content */}
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium leading-tight">
							{source.domain}
							</p>

							<div className="mt-1 text-xs text-muted-foreground">
							{source.citationCount} citations
							</div>
						</div>
						</div>
					</div>

					{/* RIGHT SIDE (Percentage) */}
					<div className="w-10 shrink-0 text-right text-xs font-semibold text-black dark:text-white">
						{usagePercent}%
					</div>
					</div>
			  );
		  })}
		</div>
	  </Card>
	);
  }