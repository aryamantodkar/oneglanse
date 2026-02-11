import { BarChart3, Building2, Sparkles } from "lucide-react";
import { Skeleton } from "@onescope/ui";

export function DashboardSkeleton() {
	return (
		<div className="min-h-screen">
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				{/* Header */}
				<div>
					<Skeleton className="mb-2 h-7 w-56" />
					<Skeleton className="h-4 w-80" />
				</div>
				{/* Filters */}
				<div className="flex gap-3">
					<Skeleton className="h-9 w-44 rounded-lg" />
					<Skeleton className="h-9 w-40 rounded-lg" />
				</div>
				{/* Hero gauge */}
				<Skeleton className="h-56 rounded-xl" />
				{/* 2x2 metric grid */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
				</div>
				{/* Stats row */}
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
				</div>
				{/* Competitive landscape */}
				<Skeleton className="h-64 rounded-xl" />
				{/* Sentiment + Perception */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Skeleton className="h-56 rounded-xl" />
					<Skeleton className="h-56 rounded-xl" />
				</div>
				{/* Sources */}
				<Skeleton className="h-48 rounded-xl" />
				{/* Table */}
				<Skeleton className="h-64 rounded-xl" />
			</div>
		</div>
	);
}

export function NoWorkspaceState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<Building2 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					Select a workspace
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Choose a workspace from the sidebar to view your AI visibility
					dashboard.
				</p>
			</div>
		</div>
	);
}

export function EmptyState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					No data yet
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Start tracking your brand&apos;s AI visibility by adding prompts and
					running agents from the Prompts page.
				</p>
			</div>
		</div>
	);
}

export function NoAnalysisState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<Sparkles className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					Analysis pending
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Your responses haven&apos;t been analyzed yet. Run analysis from the
					Prompts page to populate your dashboard.
				</p>
			</div>
		</div>
	);
}
