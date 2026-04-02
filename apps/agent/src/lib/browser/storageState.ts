import type { BrowserContext, Page } from "playwright-core";

type StorageStateCookie = {
	name?: string;
	value?: string;
	domain?: string;
	path?: string;
	expires?: number;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: "Strict" | "Lax" | "None";
};

type StorageStateOrigin = {
	origin?: string;
	localStorage?: Array<{ name?: string; value?: string }>;
};

export type PersistentStorageState = {
	cookies?: StorageStateCookie[];
	origins?: StorageStateOrigin[];
};

function normalizeCookies(
	cookies: StorageStateCookie[] | undefined,
): Required<
	Pick<
		StorageStateCookie,
		"name" | "value" | "domain" | "path" | "expires" | "httpOnly" | "secure"
	>
>[]
	& Array<Pick<StorageStateCookie, "sameSite">> {
	return (cookies ?? [])
		.map((cookie) => {
			const name = cookie.name?.trim();
			const domain = cookie.domain?.trim();
			if (!name || !domain) {
				return null;
			}

			return {
				name,
				value: cookie.value ?? "",
				domain,
				path: cookie.path?.trim() || "/",
				expires:
					typeof cookie.expires === "number" ? cookie.expires : -1,
				httpOnly: Boolean(cookie.httpOnly),
				secure: Boolean(cookie.secure),
				...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
			};
		})
		.filter((cookie): cookie is NonNullable<typeof cookie> => cookie !== null);
}

function normalizeOrigins(origins: StorageStateOrigin[] | undefined): Array<{
	origin: string;
	localStorage: Array<{ name: string; value: string }>;
}> {
	return (origins ?? [])
		.map((originEntry) => {
			const origin = originEntry.origin?.trim();
			if (!origin) {
				return null;
			}

			const localStorage = (originEntry.localStorage ?? [])
				.map((item) => {
					const name = item.name?.trim();
					if (!name) {
						return null;
					}

					return {
						name,
						value: item.value ?? "",
					};
				})
				.filter((item): item is NonNullable<typeof item> => item !== null);

			return { origin, localStorage };
		})
		.filter(
			(originEntry): originEntry is NonNullable<typeof originEntry> =>
				originEntry !== null,
		);
}

async function getSeedPage(context: BrowserContext): Promise<Page> {
	const existingPage = context.pages().find((page) => !page.isClosed());
	if (existingPage) {
		return existingPage;
	}

	return context.waitForEvent("page", { timeout: 15_000 });
}

export async function applyCookiesToPersistentContext(
	context: BrowserContext,
	state: PersistentStorageState | null,
): Promise<void> {
	if (!state) {
		return;
	}

	const cookies = normalizeCookies(state.cookies);
	if (cookies.length === 0) {
		return;
	}

	await context.addCookies(cookies);
}

export async function applyStorageStateToPersistentContext(
	context: BrowserContext,
	state: PersistentStorageState | null,
): Promise<void> {
	if (!state) {
		return;
	}

	await applyCookiesToPersistentContext(context, state);

	const origins = normalizeOrigins(state.origins);
	if (origins.length === 0) {
		return;
	}

	const page = await getSeedPage(context);

	for (const originEntry of origins) {
		await page.goto(originEntry.origin, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});

		await page.evaluate(({ localStorageItems }) => {
			window.localStorage.clear();
			for (const item of localStorageItems) {
				window.localStorage.setItem(item.name, item.value);
			}
		}, { localStorageItems: originEntry.localStorage });
	}

	await page.goto("about:blank", {
		waitUntil: "domcontentloaded",
		timeout: 30_000,
	});
}
