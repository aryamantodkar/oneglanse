import type { AnalysisRecord } from "@oneglanse/types";
import { Card } from "@oneglanse/ui";
import { MessagesSquare } from "lucide-react";
import { DashboardEmptyState } from "./empty-state";

function toTimestamp(value: string | null | undefined): number {
	if (!value) return 0;
	const ts = new Date(value).getTime();
	return Number.isNaN(ts) ? 0 : ts;
}

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown date";
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function compactText(value: string, maxLength = 260): string {
	const clean = value.replace(/\s+/g, " ").trim();
	if (clean.length <= maxLength) return clean;
	return `${clean.slice(0, maxLength - 1)}…`;
}

export function LatestAnalyzedPrompts({
	records,
}: {
	records: AnalysisRecord[];
}){
	const latestRecords = [...records]
		.sort((a, b) => {
			const aTime = Math.max(toTimestamp(a.prompt_run_at), toTimestamp(a.created_at));
			const bTime = Math.max(toTimestamp(b.prompt_run_at), toTimestamp(b.created_at));
			return bTime - aTime;
		})
		.slice(0, 3);

	return (
		<Card className="flex h-full min-h-[360px] flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<div>
				<h1 className="mt-1 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
					Latest Analyzed Prompts
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Top 3 most recent analyzed prompt-response pairs for this filter view.
				</p>
			</div>

			{latestRecords.length === 0 ? (
				<DashboardEmptyState
					icon={MessagesSquare}
					title="No analyzed prompts"
					description="No analyzed prompt-response data is available for the selected filters."
				/>
			) : (
				<div className="mt-4 flex flex-1 flex-col gap-3">
					{latestRecords.map((record, index) => (
						<div
							key={record.id}
							className="ui-list-item rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
						>
							<div className="mb-3 flex items-center justify-between gap-2">
								<span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-gray-700 dark:bg-gray-800">
									#{index + 1} • {record.model_provider}
								</span>
								<span className="text-[11px] text-muted-foreground">
									{formatDate(record.prompt_run_at || record.created_at)}
								</span>
							</div>

							<div>
								<p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									Prompt
								</p>
								<p className="mt-1 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
									{compactText(record.prompt, 180)}
								</p>
							</div>

							<div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
								<p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									Response
								</p>
								<p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
									{compactText(record.response, 260)}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</Card>
	);
}
