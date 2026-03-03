"use client";

export type SortDirection = "asc" | "desc";

export function SortableHeaderButton({
	label,
	isActive,
	direction,
	onClick,
	className = "",
}: {
	label: string;
	isActive: boolean;
	direction: SortDirection;
	onClick: () => void;
	className?: string;
}): React.JSX.Element {
	const arrow = isActive ? (direction === "asc" ? "↑" : "↓") : "";

	return (
		<button
			type="button"
			className={`inline-flex items-center gap-1 hover:text-foreground ${className}`}
			onClick={onClick}
		>
			{label}
			<span className="text-[10px]">{arrow}</span>
		</button>
	);
}
