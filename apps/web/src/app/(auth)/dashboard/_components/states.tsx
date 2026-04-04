import {
	Button,
	EmptyStatePanel,
	Skeleton,
	WorkspaceRequiredState,
} from "@oneglanse/ui";
import { Building2 } from "lucide-react";
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
						<Skeleton className="h-9 w-44 rounded-lg" />
						<Skeleton className="h-9 w-44 rounded-lg" />
						<Skeleton className="h-9 w-40 rounded-lg" />
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{DASHBOARD_SKELETON_KEYS.map((key) => (
							<div
								key={key}
								className="rounded-[24px] border border-gray-100/80 bg-white p-4 dark:border-gray-800 dark:bg-neutral-950"
							>
								<Skeleton className="h-3 w-20 rounded" />
								<Skeleton className="mt-4 h-8 w-24 rounded" />
								<Skeleton className="mt-3 h-3 w-40 rounded" />
							</div>
						))}
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<Skeleton className="h-[500px] rounded-2xl" />
						<Skeleton className="h-[500px] rounded-2xl" />
						<Skeleton className="h-[500px] rounded-2xl" />
					</div>

					<Skeleton className="h-[360px] rounded-2xl" />
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
			title="Your Visibility Dashboard Starts Here"
			description="Run your first prompts to unlock rank, presence, sources, and competitor signals."
			examplesLabel="What this dashboard unlocks"
			examples={[
				"Presence rate across prompts",
				"Average rank across providers",
				"Top source and top competitor signals",
			]}
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
			title="Responses Ready. Insights Next."
			description="Run analysis to turn responses into dashboard signals."
			action={
				<Button asChild>
					<Link href={`/prompts?workspace=${workspaceId}`}>Go to Prompts</Link>
				</Button>
			}
		/>
	);
}
