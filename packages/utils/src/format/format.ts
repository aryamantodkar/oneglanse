export function formatDateToClickHouse(dt: Date) {
	// ClickHouse DateTime expects format: YYYY-MM-DD HH:MM:SS (no milliseconds, no timezone)
	const year = dt.getUTCFullYear();
	const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
	const day = String(dt.getUTCDate()).padStart(2, "0");
	const hours = String(dt.getUTCHours()).padStart(2, "0");
	const minutes = String(dt.getUTCMinutes()).padStart(2, "0");
	const seconds = String(dt.getUTCSeconds()).padStart(2, "0");

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const getCleanUrl = (url: string) => {
	try {
		const u = new URL(url);
		u.searchParams.delete("utm_source"); // remove utm_source
		u.searchParams.delete("utm_medium"); // optional: remove other tracking params
		u.searchParams.delete("utm_campaign");
		return u.toString();
	} catch {
		return url; // return as-is if invalid
	}
};
