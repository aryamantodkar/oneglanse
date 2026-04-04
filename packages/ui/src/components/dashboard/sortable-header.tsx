"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortableHeader<C extends string>({
	children,
	column,
	currentSort,
	currentDirection,
	onSort,
	onResetSort,
	className = "",
}: {
	children: React.ReactNode;
	column: C;
	currentSort: C | null;
	currentDirection: "asc" | "desc";
	onSort: (column: C) => void;
	onResetSort?: () => void;
	className?: string;
}): React.JSX.Element {
	const isActive = currentSort === column;

	return (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation();
				onSort(column);
			}}
			onDoubleClick={(event) => {
				if (!isActive || !onResetSort) return;
				event.stopPropagation();
				onResetSort();
			}}
			className={`inline-flex items-center gap-1 transition-colors hover:text-gray-900 dark:hover:text-gray-100 ${className}`}
		>
			{children}
			{isActive ? (
				currentDirection === "asc" ? (
					<ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
				) : (
					<ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
				)
			) : (
				<ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
			)}
		</button>
	);
}
