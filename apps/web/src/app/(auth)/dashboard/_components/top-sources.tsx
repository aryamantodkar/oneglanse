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
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">Top Sources</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-2">
					{sources.slice(0, 5).map((source, idx) => {
						const faviconUrl =
							source.favicon || getFaviconUrls(source.domain, "")[0];
						const usagePercent = Math.round((source.uniqueRecords.size / totalRecords) * 100);

						return (
							<div key={source.domain} className="flex items-center justify-between py-2.5">
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<span className="text-gray-400 text-xs font-medium w-6 shrink-0">
										{idx + 1}
									</span>
									{faviconUrl && (
										<img
											src={faviconUrl}
											alt=""
											className="h-4 w-4 rounded-sm shrink-0"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = "none";
											}}
										/>
									)}
									<span className="font-medium text-sm truncate">
										{source.domain}
									</span>
								</div>
								<div className="flex items-center gap-4 shrink-0">
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											{usagePercent}%
										</div>
										<div className="text-[10px] text-gray-400">
											usage
										</div>
									</div>
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											{source.citationCount}
										</div>
										<div className="text-[10px] text-gray-400">
											citations
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
