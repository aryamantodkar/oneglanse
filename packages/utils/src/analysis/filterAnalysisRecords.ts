import type { AnalysisFilters, AnalysisRecord } from "@oneglanse/types";
import { isWithinRange } from "../format/dateFilter.js";

export function filterAnalysisRecords(
	records: AnalysisRecord[],
	filters: AnalysisFilters,
): AnalysisRecord[] {
	return records.filter((record) => {
		// Model filter
		if (filters.modelFilter && filters.modelFilter !== "All Models") {
			if (record.model_provider !== filters.modelFilter) return false;
		}

		// Time filter
		if (filters.timeFilter && filters.timeFilter !== "all") {
			const days =
				filters.timeFilter === "7d"
					? 7
					: filters.timeFilter === "14d"
						? 14
						: 30;
			if (!isWithinRange(record.prompt_run_at, days)) return false;
		}

		// Prompt ID filter (for detail view)
		if (filters.promptId && record.prompt_id !== filters.promptId) {
			return false;
		}

		return true;
	});
}
