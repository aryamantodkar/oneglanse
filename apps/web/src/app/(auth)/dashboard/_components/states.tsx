import {
	Button,
	EmptyStatePanel,
	Skeleton,
	WorkspaceRequiredState,
} from "@oneglanse/ui";
import { BarChart3, Building2, Link2, Trophy, Users } from "lucide-react";
import Link from "next/link";

const DASHBOARD_SKELETON_KEYS = [
	"dashboard-skeleton-a",
	"dashboard-skeleton-b",
	"dashboard-skeleton-c",
	"dashboard-skeleton-d",
] as const;

export function DashboardSkeleton() {
	return (
		<div className="web-page-wide">
			<div className="web-page-wide-inner py-4">
				<div className="space-y-6">
					<div className="flex items-center gap-3">
						<Skeleton className="h-9 w-44 rounded-[var(--app-radius)]" />
						<Skeleton className="h-9 w-44 rounded-[var(--app-radius)]" />
						<Skeleton className="h-9 w-40 rounded-[var(--app-radius)]" />
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{DASHBOARD_SKELETON_KEYS.map((key) => (
							<div
								key={key}
								className="rounded-[var(--app-radius)] border border-gray-100/80 bg-white p-4 dark:border-gray-800 dark:bg-neutral-950"
							>
								<Skeleton className="h-3 w-20 rounded" />
								<Skeleton className="mt-4 h-8 w-24 rounded" />
								<Skeleton className="mt-3 h-3 w-40 rounded" />
							</div>
						))}
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Skeleton className="h-[280px] rounded-[var(--app-radius)] sm:h-[380px] lg:h-[500px]" />
						<Skeleton className="h-[280px] rounded-[var(--app-radius)] sm:h-[380px] lg:h-[500px]" />
						<Skeleton className="h-[280px] rounded-[var(--app-radius)] sm:h-[380px] lg:h-[500px]" />
					</div>

					<Skeleton className="h-[200px] rounded-[var(--app-radius)] sm:h-[280px] lg:h-[360px]" />
				</div>
			</div>
		</div>
	);
}

export function NoWorkspaceState() {
	return (
		<WorkspaceRequiredState
			icon={Building2}
			title="Pick a Workspace"
			description="Open a workspace to see your brand dashboard."
		/>
	);
}

export function EmptyState({ workspaceId }: { workspaceId: string }) {
	return (
		<EmptyStatePanel
			icon={BarChart3}
			title="Your Visibility Dashboard Starts Here"
			description="Run your first prompts to unlock rank, presence, sources, and competitor signals."
			examplesLabel="What this dashboard unlocks"
			examples={[
				{ icon: Trophy, label: "Average rank across providers" },
				{ icon: Link2, label: "Top source signals" },
				{ icon: Users, label: "Top competitor signals" },
			]}
			action={
				<Button asChild>
					<Link href={`/prompts?workspace=${workspaceId}`}>Open Prompts</Link>
				</Button>
			}
		/>
	);
}

export function FilteredDashboardState({
	workspaceId,
	modelFilter,
}: {
	workspaceId: string;
	modelFilter: string;
}) {
	const isModelSpecific = modelFilter !== "All Models";

	return (
		<EmptyStatePanel
			eyebrow="No matching dashboard data"
			title={
				isModelSpecific
					? "No data available for this model"
					: "No data available for the selected filters"
			}
			description={
				isModelSpecific
					? "Try another model or run prompts across this model to populate the dashboard."
					: "Try another model or time range to populate the dashboard."
			}
			action={
				<Button asChild>
					<Link href={`/prompts?workspace=${workspaceId}`}>Open Prompts</Link>
				</Button>
			}
		/>
	);
}

export function NoAnalysisState({ workspaceId }: { workspaceId: string }) {
	return (
		<EmptyStatePanel
			eyebrow="Analysis required"
			title="No analyzed data available yet"
			description="Run prompts and analysis to populate the dashboard."
			action={
				<Button asChild>
					<Link href={`/prompts?workspace=${workspaceId}`}>Go to Prompts</Link>
				</Button>
			}
		/>
	);
}
