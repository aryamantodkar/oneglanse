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
		<div className="web-centered-state flex-1">
			<div className="w-full max-w-xs rounded-[24px] border border-gray-100/80 bg-white px-6 py-8 text-center shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]">
				<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-gray-200/70 bg-stone-100 dark:border-gray-800 dark:bg-neutral-900">
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
