import { Globe, Link2, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
	label,
	value,
	subtitle,
	icon: Icon,
	valueClassName = "text-gray-900 dark:text-gray-100",
}: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: LucideIcon;
	valueClassName?: string;
}) {
	return (
		<div className="ui-list-item group flex min-h-[120px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900">
			<div className="flex items-center gap-2">
				<Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
				<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					{label}
				</span>
			</div>

			<div className="mt-3 flex h-[40px] items-center gap-2">
				<span
					className={`truncate text-2xl font-semibold leading-none tracking-tight ${valueClassName}`}
				>
					{value}
				</span>
			</div>

			{subtitle && (
				<span className="mt-1 truncate text-xs text-muted-foreground">
					{subtitle}
				</span>
			)}
		</div>
	);
}

export function AggregateStatsRow({
	presenceRate,
	rank,
	topSource,
	topCompetitor,
}: {
	presenceRate: number;
	rank: number | null;
	topSource: string;
	topCompetitor: string;
}) {
	const rankValue = rank !== null ? `#${rank}` : "N/A";

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<StatCard
				icon={Globe}
				label="Presence Rate"
				value={`${presenceRate}%`}
				subtitle="Queries mentioning your brand"
			/>
			<StatCard
				icon={Trophy}
				label="Avg Rank"
				value={rankValue}
				subtitle="Average placement across ranked responses"
			/>
			<StatCard
				icon={Link2}
				label="Top Source"
				value={topSource}
				subtitle="Most cited domain in AI answers"
			/>
			<StatCard
				icon={Users}
				label="Top Competitor"
				value={topCompetitor}
				subtitle="Most frequently appears with you"
			/>
		</div>
	);
}
