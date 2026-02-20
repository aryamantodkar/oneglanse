export function removeUrlParams(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);

		// Remove all utm_* params
		for (const key of Array.from(url.searchParams.keys())) {
			if (key.toLowerCase().startsWith("utm_")) {
				url.searchParams.delete(key);
			}
		}

		// Optional: remove other common junk params
		["ref", "source", "fbclid", "gclid"].forEach((p) =>
			url.searchParams.delete(p),
		);

		// Clean trailing ?
		url.search = url.searchParams.toString();

		return url.toString();
	} catch {
		// If URL parsing fails, return original
		return rawUrl;
	}
}
