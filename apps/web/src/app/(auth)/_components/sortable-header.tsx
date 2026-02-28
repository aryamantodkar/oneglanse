import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortableHeader<C extends string>({
	children,
	column,
	currentSort,
	currentDirection,
	onSort,
}: {
	children: React.ReactNode;
	column: C;
	currentSort: C | null;
	currentDirection: "asc" | "desc";
	onSort: (column: C) => void;
}) {
	const isActive = currentSort === column;

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onSort(column);
			}}
			className="flex items-center gap-1 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
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
