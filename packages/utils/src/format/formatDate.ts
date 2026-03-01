const CLICKHOUSE_DATETIME_RE =
	/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

/**
 * Parse timestamps returned by ClickHouse as UTC when they have no timezone info.
 * ClickHouse DateTime commonly returns "YYYY-MM-DD HH:mm:ss" (UTC in our writes).
 */
export function parseDateString(dateStr: string): Date {
	if (CLICKHOUSE_DATETIME_RE.test(dateStr)) {
		const isoLike = dateStr.replace(" ", "T");
		return new Date(`${isoLike}Z`);
	}
	return new Date(dateStr);
}

export const formatDate = (dateStr: string) => {
	const d = parseDateString(dateStr);

	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = String(d.getFullYear()).slice(-2);

	let hours = d.getHours();
	const minutes = String(d.getMinutes()).padStart(2, "0");

	const ampm = hours >= 12 ? "PM" : "AM";
	hours = hours % 12 || 12; // convert 0 → 12

	return `${day}/${month}/${year} · ${hours}:${minutes} ${ampm}`;
};
