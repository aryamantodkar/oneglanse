"use client";

import { cn, getFaviconUrls } from "@oneglanse/utils";
import { Globe, Link2, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function StatCard({
	label,
	value,
	subtitle,
	icon: Icon,
	valueClassName = "text-gray-900 dark:text-gray-100",
	domain,
}: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: LucideIcon;
	valueClassName?: string;
	domain?: string;
}) {
	const isStringValue = typeof value === "string";
	const showFavicon =
		isStringValue && (label === "Top Source" || label === "Top Competitor");
	const faviconUrls = showFavicon
		? getFaviconUrls(domain || String(value), String(value))
		: [];

	return (
		<div className="ui-list-item group flex min-h-[120px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-black">
			<div className="flex items-center gap-2">
				<Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
				<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					{label}
				</span>
			</div>

			<div className="mt-3 flex min-h-[40px] items-center gap-2 py-0.5">
				{showFavicon && faviconUrls[0] && (
					<img
						src={faviconUrls[0]}
						alt=""
						className="h-5 w-5 shrink-0 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				)}
				<span
					className={`truncate text-2xl font-semibold leading-tight tracking-tight ${valueClassName}`}
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
	topCompetitorDomain,
	noData = false,
	className,
}: {
	presenceRate: number;
	rank: number;
	topSource: string;
	topCompetitor: string;
	topCompetitorDomain?: string;
	noData?: boolean;
	className?: string;
}) {
	const emptySubtitle = "No analysis data for selected filters";

	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
				className,
			)}
		>
			<StatCard
				icon={Globe}
				label="Presence Rate"
				value={noData ? "—" : `${presenceRate}%`}
				subtitle={noData ? emptySubtitle : "Prompts mentioning your brand"}
			/>
			<StatCard
				icon={Trophy}
				label="Rank"
				value={noData ? "—" : `#${rank}`}
				subtitle={noData ? emptySubtitle : "Avg rank across prompts"}
			/>
			<StatCard
				icon={Link2}
				label="Top Source"
				value={noData ? "—" : topSource}
				subtitle={noData ? emptySubtitle : "Most cited information source"}
			/>
			<StatCard
				icon={Users}
				label="Top Competitor"
				value={noData ? "—" : topCompetitor}
				subtitle={noData ? emptySubtitle : "Most frequently appears with you"}
				domain={noData ? undefined : topCompetitorDomain}
			/>
		</div>
	);
}
