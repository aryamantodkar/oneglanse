"use client";

import { useState } from "react";

export type SortDirection = "asc" | "desc";

export function useSortState<C extends string>(
  initialColumn: C,
  initialDirection: SortDirection = "desc",
  options?: {
    nextDirectionForNewColumn?: (column: C) => SortDirection;
  },
): {
  sortColumn: C;
  sortDirection: SortDirection;
  toggleSort: (column: C) => void;
} {
  const [sortColumn, setSortColumn] = useState<C>(initialColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const toggleSort = (column: C) => {
    setSortColumn((currentColumn) => {
      if (currentColumn === column) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentColumn;
      }

      setSortDirection(options?.nextDirectionForNewColumn?.(column) ?? "desc");
      return column;
    });
  };

  return {
    sortColumn,
    sortDirection,
    toggleSort,
  };
}
