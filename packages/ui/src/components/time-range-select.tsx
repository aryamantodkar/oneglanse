"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.js";

export type TimeRange = "all" | "7d" | "14d" | "30d";

export function TimeRangeSelect({
  value,
  onValueChange,
  triggerClassName,
  contentClassName,
  placeholder = "Time range",
}: {
  value: TimeRange;
  onValueChange: (value: TimeRange) => void;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as TimeRange)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        <SelectItem value="all">All time</SelectItem>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="14d">Last 14 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
