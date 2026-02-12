import { getFaviconUrls } from "@onescope/utils";
import { Award, Globe, TrendingUp, Users } from "lucide-react";

export function PillTag({
	label,
	className = "",
}: { label: string; className?: string }) {
	return (
		<span
			className={`inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}
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
	domain,
  }: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: typeof TrendingUp;
	domain?: string;
  }) {
	const isStringValue = typeof value === "string";
	const showFavicon =
	  isStringValue &&
	  (label === "Top Source" || label === "Top Competitor");

	const faviconUrls = showFavicon
	  ? getFaviconUrls(domain || String(value), String(value))
	  : [];
  
	return (
	  <div
		className="
		  group flex min-h-[120px] flex-col justify-between
		  rounded-2xl border border-gray-200 bg-white p-4
		  transition hover:border-gray-300
		  dark:border-gray-800 dark:bg-gray-900
		"
	  >
		{/* Header */}
		<div className="flex items-center gap-2">
		  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
		  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
			{label}
		  </span>
		</div>
  
		{/* Value Row */}
		<div className="mt-3 flex items-center gap-2 h-[40px]">
		  {showFavicon && faviconUrls[0] && (
			<img
			  src={faviconUrls[0]}
			  alt=""
			  className="h-5 w-5 rounded-md object-contain shrink-0"
			  onError={(e) =>
				((e.target as HTMLImageElement).style.display = "none")
			  }
			/>
		  )}
  
		  <span
			className="
			  text-2xl font-semibold tracking-tight text-gray-900
			  leading-none truncate
			  dark:text-gray-100
			"
		  >
			{value}
		  </span>
		</div>
  
		{/* Subtitle */}
		{subtitle && (
		  <span className="text-xs text-muted-foreground mt-1 truncate">
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
	topCompetitorDomain,
}: {
	presenceRate: number;
	rank: number;
	topSource: string;
	topCompetitor: string;
	topCompetitorDomain?: string;
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
				domain={topCompetitorDomain}
			/>
		</div>
	);
}
