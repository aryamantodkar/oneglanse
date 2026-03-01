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
		<div className="flex flex-1 items-center justify-center py-8">
			<div className="w-full max-w-xs text-center">
				<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100/70 dark:bg-gray-800/80">
					<Icon className="h-4.5 w-4.5 text-gray-500 dark:text-gray-400" />
				</div>
				<p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
					{title}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>
		</div>
	);
}
