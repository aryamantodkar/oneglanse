import { getFaviconUrls } from "@onescope/utils";
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
  }: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: typeof TrendingUp;
  }) {
	const isStringValue = typeof value === "string";
	const showFavicon =
	  isStringValue &&
	  (label === "Top Source" || label === "Top Competitor");
  
	const faviconUrls = showFavicon
	  ? getFaviconUrls(String(value), "")
	  : [];
  
	return (
	  <div className="
		flex flex-col justify-between
		rounded-xl border border-gray-100
		bg-card p-4
		dark:border-gray-800
		min-h-[120px]
	  ">
		{/* Header */}
		<div className="flex items-center gap-2">
		  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
		  <span className="text-xs font-medium text-muted-foreground">
			{label}
		  </span>
		</div>
  
		{/* Value Row (ALWAYS SAME STRUCTURE) */}
		<div className="flex items-center gap-2 mt-2 min-h-[36px]">
		  {/* Favicon slot (reserved space) */}
		  <div className="w-5 h-5 flex items-center justify-center shrink-0">
			{showFavicon && (
			  <img
				src={faviconUrls[0]}
				alt=""
				className="w-5 h-5 rounded-md object-contain"
				onError={(e) =>
				  ((e.target as HTMLImageElement).style.visibility = "hidden")
				}
			  />
			)}
		  </div>
  
		  {/* Value */}
		  <span className="text-2xl font-bold tracking-tight leading-none truncate max-w-[160px]">
			{value}
		  </span>
		</div>
  
		{/* Subtitle */}
		{subtitle && (
		  <span className="text-xs text-muted-foreground mt-1">
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
	topCompetitor
}: {
	presenceRate: number;
	rank: number;
	topSource: string;
	topCompetitor: string;
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
				icon={TrendingUp}
				label="Top Source"
				value={topSource}
				subtitle="Most cited information source"
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
