function downloadBlob(
	filename: string,
	mimeType: string,
	content: string,
): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
	downloadBlob(
		filename,
		"application/json;charset=utf-8",
		JSON.stringify(data, null, 2),
	);
}

function escapeCsvValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	const stringValue =
		typeof value === "string"
			? value
			: typeof value === "object"
				? JSON.stringify(value)
				: String(value);
	if (/[",\n]/.test(stringValue)) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
	if (!rows.length) return "";
	const headers = Array.from(
		rows.reduce((set, row) => {
			for (const key of Object.keys(row)) set.add(key);
			return set;
		}, new Set<string>()),
	);

	const headerLine = headers.join(",");
	const bodyLines = rows.map((row) =>
		headers.map((header) => escapeCsvValue(row[header])).join(","),
	);
	return [headerLine, ...bodyLines].join("\n");
}

export function downloadCsv(
	filename: string,
	rows: Array<Record<string, unknown>>,
): void {
	const csv = rowsToCsv(rows);
	downloadBlob(filename, "text/csv;charset=utf-8", csv);
}
