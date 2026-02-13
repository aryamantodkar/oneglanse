import { Card } from "@onescope/ui";
import { Eye, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function SignalTile({
	label,
	value,
	subtitle,
	icon: Icon,
	noData,
}: {
	label: string;
	value: string;
	subtitle: string;
	icon: LucideIcon;
	noData: boolean;
}) {
	return (
		<div className="ui-list-item rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
			<div className="flex items-center gap-2">
				<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					{label}
				</span>
			</div>
			<p className="mt-2 text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
				{noData ? "—" : value}
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{noData ? "No analysis data for selected filters" : subtitle}
			</p>
		</div>
	);
}

export function ImpactSignals({
	avgVisibility,
	recommendationRate,
	topPickRate,
	riskResponseRate,
	noData,
}: {
	avgVisibility: number;
	recommendationRate: number;
	topPickRate: number;
	riskResponseRate: number;
	noData: boolean;
}) {
	const riskFreeRate = Math.max(0, 100 - riskResponseRate);

	return (
		<Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<div>
				<h1 className="mt-1 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
					Impact Signals
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Additional performance metrics that improve AI visibility decisions.
				</p>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
				<SignalTile
					label="Visibility"
					value={`${avgVisibility}%`}
					subtitle="Average visibility score in answers"
					icon={Eye}
					noData={noData}
				/>
				<SignalTile
					label="Recommended"
					value={`${recommendationRate}%`}
					subtitle="Responses that recommend your brand"
					icon={Sparkles}
					noData={noData}
				/>
				<SignalTile
					label="Top Pick Share"
					value={`${topPickRate}%`}
					subtitle="Responses where you are the top pick"
					icon={Trophy}
					noData={noData}
				/>
				<SignalTile
					label="Risk-Free"
					value={`${riskFreeRate}%`}
					subtitle="Responses without detected risks"
					icon={ShieldCheck}
					noData={noData}
				/>
			</div>
		</Card>
	);
}
