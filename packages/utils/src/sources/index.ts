type MaybeString = string | null | undefined;

type CitedTextLike = {
	cited_text?: MaybeString;
	citedText?: MaybeString;
};

type ModelProviderLike = {
	model_provider?: MaybeString;
	modelProvider?: MaybeString;
};

type UrlLike = {
	url?: MaybeString;
};

function pickCitedText(value: CitedTextLike): MaybeString {
	return value.cited_text ?? value.citedText;
}

function pickModelProvider(value: ModelProviderLike): MaybeString {
	return value.model_provider ?? value.modelProvider;
}

export function formatCitationLabel(count: number): string {
	return `${count} citation${count === 1 ? "" : "s"}`;
}

export function getUrlPath(url: string): string {
	try {
		const parsed = new URL(url);
		const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
		return path && path !== "/" ? path : "/";
	} catch {
		return "/";
	}
}

export function cleanCitedText(text: string): string {
	return text.replace(/\s*(?:\.\.\.|…)?\s*read more\.?\s*$/i, "").trim();
}

export function getUniqueModelProviders<T extends ModelProviderLike>(
	items: T[] = [],
): string[] {
	return [
		...new Set(
			items
				.map((item) => pickModelProvider(item)?.trim())
				.filter((provider): provider is string => Boolean(provider)),
		),
	];
}

export function joinSourceUrls<T extends UrlLike>(
	items: T[] = [],
	separator = " | ",
): string {
	return items
		.map((item) => item.url?.trim())
		.filter((url): url is string => Boolean(url))
		.join(separator);
}

export function joinCitedTexts<T extends CitedTextLike>(
	items: T[] = [],
	options?: {
		separator?: string;
		clean?: boolean;
	},
): string {
	const separator = options?.separator ?? " | ";
	const shouldClean = options?.clean ?? false;

	return items
		.map((item) => pickCitedText(item)?.trim())
		.filter((text): text is string => Boolean(text))
		.map((text) => (shouldClean ? cleanCitedText(text) : text))
		.join(separator);
}
