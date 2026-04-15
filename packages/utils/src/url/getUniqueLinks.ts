export function getUniqueLinks(
	items: { title?: string; url?: string }[] = [],
): { title: string; url: string }[] {
	const results: { title: string; url: string }[] = [];

	for (const item of items) {
		const rawUrl = item?.url?.trim();
		if (!rawUrl) continue;

		const url = rawUrl.replace(/#.*$/, "");
		if (!url) continue;

		results.push({
			title: item.title || url,
			url,
		});
	}

	return results;
}
