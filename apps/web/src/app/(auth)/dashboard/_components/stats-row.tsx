import { Award, Globe, TrendingUp, Users } from "lucide-react";

export function PillTag({
	label,
	className = "",
}: { label: string; className?: string }) {
	return (
		<span
			className={`inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300 ${className}`}
		>
			{label}
		</span>
	);
}

export function StatCard({
	label,
	value,
	subtitle,
	icon: Icon,
	favicon,
}: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: typeof TrendingUp;
	favicon?: string | null;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
			<div className="mb-1 flex items-center gap-2">
				{favicon ? (
					<img
						src={favicon}
						alt=""
						className="h-3.5 w-3.5 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				) : (
					<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				)}
				<span className="font-medium text-muted-foreground text-xs">
					{label}
				</span>
			</div>
			<span className="font-bold text-2xl tracking-tight">{value}</span>
			{subtitle && (
				<span className="text-muted-foreground text-xs">{subtitle}</span>
			)}
		</div>
	);
}

export function AggregateStatsRow({
	presenceRate,
	rank,
	topSource,
	topSourceFavicon,
	topCompetitor,
	topCompetitorFavicon,
}: {
	presenceRate: number;
	rank: number;
	topSource: string;
	topSourceFavicon?: string | null;
	topCompetitor: string;
	topCompetitorFavicon?: string | null;
}) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<StatCard
				icon={Globe}
				label="Presence Rate"
				value={`${presenceRate}%`}
				subtitle="Prompts mentioning your brand"
			/>
			<StatCard
				icon={Award}
				label="Rank"
				value={`#${rank}`}
				subtitle="Avg rank across prompts"
			/>
			<StatCard
				icon={Globe}
				label="Top Source"
				value={topSource}
				subtitle="Most cited information source"
				favicon={topSourceFavicon}
			/>
			<StatCard
				icon={Users}
				label="Top Competitor"
				value={topCompetitor}
				subtitle="Most frequently appears with you"
				favicon={topCompetitorFavicon}
			/>
		</div>
	);
}
