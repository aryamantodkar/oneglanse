"use client";

import { useState } from "react";

export type SortDirection = "asc" | "desc";

export function useSortState<C extends string>(
	initialColumn: C,
	initialDirection: SortDirection = "asc",
	options?: {
		nextDirectionForNewColumn?: (column: C) => SortDirection;
	},
): {
	sortColumn: C | null;
	sortDirection: SortDirection;
	toggleSort: (column: C) => void;
	resetSort: () => void;
} {
	const [sortColumn, setSortColumn] = useState<C | null>(null);
	const [sortDirection, setSortDirection] =
		useState<SortDirection>(initialDirection);

	const toggleSort = (column: C) => {
		if (sortColumn === column) {
			setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortColumn(column);
			setSortDirection(options?.nextDirectionForNewColumn?.(column) ?? "asc");
		}
	};

	const resetSort = () => {
		setSortColumn(null);
		setSortDirection(initialDirection);
	};

	return {
		sortColumn,
		sortDirection,
		toggleSort,
		resetSort,
	};
}
