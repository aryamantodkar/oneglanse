import { Skeleton } from "@oneglanse/ui";
import { BarChart3, Building2, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function CenterState({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
}) {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-7 text-center shadow-sm dark:border-gray-800 dark:from-gray-900/70 dark:to-gray-900">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
					<Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
					{title}
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
					{description}
				</p>
			</div>
		</div>
	);
}

export function DashboardSkeleton() {
	return (
		<div className="min-h-screen dark:bg-black">
			<div className="mx-auto w-full max-w-[95vw] px-4 py-4 sm:px-6 lg:px-8 xl:max-w-[1600px]">
				<div className="space-y-6">
					<div className="flex items-center gap-3">
						<Skeleton className="h-9 w-44 rounded-lg" />
						<Skeleton className="h-9 w-44 rounded-lg" />
						<Skeleton className="h-9 w-40 rounded-lg" />
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`stats-${i}`}
								className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
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
		<CenterState
			icon={Building2}
			title="Select a workspace"
			description="Choose a workspace from the sidebar to view your AI visibility dashboard."
		/>
	);
}

export function EmptyState() {
	return (
		<CenterState
			icon={BarChart3}
			title="No data yet"
			description="Start tracking your brand's AI visibility by adding prompts and running agents from the Prompts page."
		/>
	);
}

export function NoAnalysisState() {
	return (
		<CenterState
			icon={Sparkles}
			title="Analysis pending"
			description="Your responses haven't been analyzed yet. Run analysis from the Prompts page to populate your dashboard."
		/>
	);
}
