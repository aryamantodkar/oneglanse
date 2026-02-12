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
	  <Card className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
		
		{/* Header */}
		<div>
		  <h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
			Top Sources
		  </h1>
		  <p className="mt-2 text-xs text-muted-foreground">
			Where AI pulls your brand narrative most often.
		  </p>
		</div>
  
		{/* Source List */}
		<div className="mt-4 flex flex-1 flex-col gap-2.5">
		  {sources.slice(0, 5).map((source, idx) => {
			const faviconUrl =
			  source.favicon || getFaviconUrls(source.domain, "")[0];
  
			const usagePercent = Math.round(
			  (source.uniqueRecords.size / totalRecords) * 100
			);
  
			return (
				<div
					key={source.domain}
					className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
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
							<p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
							{source.domain}
							</p>

							<div className="mt-1.5 flex items-center gap-2">
							  <span className="text-xs text-muted-foreground">
								{source.citationCount} citations
							  </span>
							  <span className="text-[10px] text-muted-foreground">
								#{idx + 1}
							  </span>
							</div>
						</div>
						</div>
					</div>

					{/* RIGHT SIDE (Percentage) */}
					<div className="w-10 shrink-0 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">
						{usagePercent}%
					</div>
					</div>
			  );
		  })}
		</div>
	  </Card>
	);
  }
