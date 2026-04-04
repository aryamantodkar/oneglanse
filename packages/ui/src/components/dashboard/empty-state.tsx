import type { LucideIcon } from "lucide-react";

import { EmptyStatePanel } from "../empty-state.js";

export function DashboardEmptyState({
	icon: Icon,
	title,
	description,
	eyebrow = "Signal builds here",
	className,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	eyebrow?: string;
	className?: string;
}) {
	return (
		<EmptyStatePanel
			icon={Icon}
			eyebrow={eyebrow}
			title={title}
			description={description}
			className={className}
			contentClassName="max-w-sm px-6 py-7"
		/>
	);
}
