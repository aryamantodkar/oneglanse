import type { LucideIcon } from "lucide-react";

export function DashboardEmptyState({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
}) {
	return (
		<div className="flex flex-1 items-center justify-center py-4">
			<div className="w-full max-w-sm rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-8 text-center dark:border-gray-800 dark:from-gray-900/70 dark:to-gray-900">
				<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<Icon className="h-5 w-5 text-muted-foreground" />
				</div>
				<p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
					{title}
				</p>
				<p className="mt-1 text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}
