import { Eye, Megaphone, ShieldAlert, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardMetrics } from "../_utils/types";

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
	impactMetrics,
	rank,
	topSource,
	topCompetitor,
}: {
	impactMetrics: DashboardMetrics["impactMetrics"];
	rank: number | null;
	topSource: string;
	topCompetitor: string;
}) {
	const riskValueClassName =
		impactMetrics.riskResponseRate >= 40
			? "text-red-600 dark:text-red-400"
			: impactMetrics.riskResponseRate >= 15
				? "text-amber-600 dark:text-amber-400"
				: "text-emerald-600 dark:text-emerald-400";

	const primaryGapLabel =
		impactMetrics.absentRate > 0
			? `Coverage gap: ${impactMetrics.absentRate}% responses don't mention your brand`
			: impactMetrics.riskResponseRate > 0
				? `Quality risk: ${impactMetrics.riskResponseRate}% responses include risk flags`
				: rank && rank > 3
					? `Ranking gap: average position is #${rank}`
					: "Strong baseline: your brand is consistently visible in responses";

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					icon={Sparkles}
					label="AI Impact Score"
					value={`${impactMetrics.avgGeoScore}/100`}
					subtitle={`Composite visibility quality across ${impactMetrics.totalResponses} responses`}
				/>
				<StatCard
					icon={Eye}
					label="Visibility Depth"
					value={`${impactMetrics.avgVisibility}%`}
					subtitle={`Appears prominently in ${impactMetrics.dominantPresenceRate}% of responses`}
				/>
				<StatCard
					icon={Megaphone}
					label="Recommendation Rate"
					value={`${impactMetrics.recommendationRate}%`}
					subtitle={`Chosen as top pick in ${impactMetrics.topPickRate}% of responses`}
				/>
				<StatCard
					icon={ShieldAlert}
					label="Risk Pressure"
					value={`${impactMetrics.riskResponseRate}%`}
					valueClassName={riskValueClassName}
					subtitle={`${impactMetrics.criticalRiskCount} critical and ${impactMetrics.warningRiskCount} warning signals`}
				/>
			</div>

			<div className="flex flex-wrap gap-2">
				<PillTag label={primaryGapLabel} />
				{topSource !== "N/A" && (
					<PillTag label={`Content battleground: ${topSource}`} />
				)}
				{topCompetitor !== "N/A" && (
					<PillTag label={`Primary answer rival: ${topCompetitor}`} />
				)}
			</div>
		</div>
	);
}
