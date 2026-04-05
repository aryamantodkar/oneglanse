import {
	PREVIEW_COMPETITORS,
	PREVIEW_COMPETITOR_PROVIDERS,
} from "@/lib/preview-data";
import {
	SentimentMetricCell,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@oneglanse/ui";
import { getFaviconUrls, getModelFavicon } from "@oneglanse/utils";

export function VisibilityScoreboardSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="visibility-scoreboard"
			aria-labelledby="visibility-scoreboard-title"
		>
			<div className="mb-6 sm:mb-8">
				<h2
					id="visibility-scoreboard-title"
					className="text-2xl font-semibold tracking-tight sm:text-3xl"
				>
					Visibility Scoreboard
				</h2>
				<p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
					See how your brand stacks up on visibility, mentions, and sentiment
					across all LLM providers.
				</p>
			</div>
			<div className="landing-surface overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="border-b border-gray-200 dark:border-gray-800">
							<TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Competitor
							</TableHead>
							<TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Visibility
							</TableHead>
							<TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Mentions
							</TableHead>
							<TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Sentiment
							</TableHead>
							<TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Providers
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{PREVIEW_COMPETITORS.map((row) => (
							<TableRow
								key={row.name}
								className="border-b border-gray-100 last:border-0 dark:border-gray-800"
							>
								<TableCell className="px-4 py-3">
									<span className="inline-flex items-center gap-2">
										<img
											src={getFaviconUrls(row.domain)[0] ?? ""}
											alt=""
											className="h-4 w-4 rounded-sm"
										/>
										<span className="font-medium text-gray-900 dark:text-gray-100">
											{row.name}
										</span>
									</span>
								</TableCell>
								<TableCell className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
									{row.visibility ?? 0}%
								</TableCell>
								<TableCell className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
									{row.appearances}
								</TableCell>
								<TableCell className="px-4 py-3 text-right">
									<span className="inline-flex items-center justify-end">
										<SentimentMetricCell sentiment={row.avgSentiment} />
									</span>
								</TableCell>
								<TableCell className="px-4 py-3 text-right">
									<span className="inline-flex w-full items-center justify-end gap-1.5">
										{(PREVIEW_COMPETITOR_PROVIDERS[row.name] ?? []).map(
											(provider) => (
												<img
													key={`${row.name}-${provider}`}
													src={getModelFavicon(provider)}
													alt={provider}
													className="h-4 w-4 rounded-sm"
													title={provider}
												/>
											),
										)}
									</span>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
