import type { LucideIcon } from "lucide-react";

export function DashboardEmptyState({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
}): React.JSX.Element {
	return (
		<div className="flex flex-1 items-center justify-center py-5">
			<div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-8 text-center shadow-sm dark:border-gray-800 dark:from-gray-900/70 dark:to-gray-900">
				<div className="-top-14 pointer-events-none absolute left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-gray-100/70 blur-2xl dark:bg-gray-700/20" />
				<div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
					<Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
				</div>
				<p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
					{title}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>
		</div>
	);
}
