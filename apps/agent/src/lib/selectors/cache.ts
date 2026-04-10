import { existsSync, mkdirSync } from "node:fs";
import { readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
	Provider,
	ProviderSelectorCache,
	SelectorProfile,
	SelectorStage,
} from "@oneglanse/types";
import {
	SELECTOR_PROFILE_VERSION,
} from "./constants.js";
import { normalizePageKey } from "./utils.js";

export function resolveMonorepoRoot(startDir = process.cwd()): string {
	let current = path.resolve(startDir);

	while (true) {
		if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
			return current;
		}

		const parent = path.dirname(current);
		if (parent === current) {
			return path.resolve(startDir);
		}
		current = parent;
	}
}

export function getSelectorCacheDir(): string {
	return path.join(resolveMonorepoRoot(), "apps/agent/selector-cache");
}

export function ensureSelectorCacheDir(): void {
	mkdirSync(getSelectorCacheDir(), { recursive: true });
}

export function getProfileCacheFile(cacheDir: string, provider: Provider): string {
	return path.join(cacheDir, `${provider}.json`);
}

function normalizeCachedProfile(
	input: unknown,
	provider: Provider,
	stage?: SelectorStage,
	pageKey?: string,
): SelectorProfile | null {
	if (!input || typeof input !== "object") {
		return null;
	}

	const candidate = input as Partial<SelectorProfile> & {
		provider?: unknown;
		stage?: unknown;
		pageKey?: unknown;
		createdAt?: unknown;
		selectors?: unknown;
	};

	if (candidate.provider !== provider) {
		return null;
	}
	if (stage !== undefined && candidate.stage !== stage) {
		return null;
	}
	if (typeof candidate.stage !== "string") {
		return null;
	}
	if (typeof candidate.pageKey !== "string" || typeof candidate.createdAt !== "string") {
		return null;
	}
	if (!candidate.selectors || typeof candidate.selectors !== "object") {
		return null;
	}

	const normalizedPageKey = normalizePageKey(candidate.pageKey);
	if (pageKey !== undefined && normalizedPageKey !== normalizePageKey(pageKey)) {
		return null;
	}

	return {
		provider,
		stage: candidate.stage as SelectorStage,
		pageKey: normalizedPageKey,
		createdAt: candidate.createdAt,
		selectors: candidate.selectors as SelectorProfile["selectors"],
	};
}

export function dedupeProfiles(profiles: SelectorProfile[]): SelectorProfile[] {
	const latestByStagePageKey = new Map<string, SelectorProfile>();

	for (const profile of profiles) {
		const normalizedPageKey = normalizePageKey(profile.pageKey);
		const normalizedProfile = {
			...profile,
			pageKey: normalizedPageKey,
		};
		const key = `${normalizedProfile.stage}:${normalizedPageKey}`;
		const existing = latestByStagePageKey.get(key);
		if (
			!existing ||
			normalizedProfile.createdAt.localeCompare(existing.createdAt) > 0
		) {
			latestByStagePageKey.set(key, normalizedProfile);
		}
	}

	return [...latestByStagePageKey.values()].sort((left, right) =>
		left.stage === right.stage
			? left.pageKey.localeCompare(right.pageKey)
			: left.stage.localeCompare(right.stage),
	);
}

export async function readProviderCache(
	provider: Provider,
): Promise<ProviderSelectorCache | null> {
	const cacheFile = getProfileCacheFile(getSelectorCacheDir(), provider);
	if (existsSync(cacheFile)) {
		try {
			const parsed = JSON.parse(
				await readFile(cacheFile, "utf8"),
			) as ProviderSelectorCache;
			if (
				parsed.version !== SELECTOR_PROFILE_VERSION ||
				parsed.provider !== provider ||
				!Array.isArray(parsed.profiles)
			) {
				return null;
			}
			const normalizedProfiles = parsed.profiles
				.map((profile) => normalizeCachedProfile(profile, provider))
				.filter((profile): profile is SelectorProfile => Boolean(profile));
			return {
				...parsed,
				profiles: dedupeProfiles(normalizedProfiles),
			};
		} catch {
			return null;
		}
	}

	return null;
}

export async function writeProviderCache(cache: ProviderSelectorCache): Promise<void> {
	ensureSelectorCacheDir();
	const normalizedCache: ProviderSelectorCache = {
		...cache,
		profiles: dedupeProfiles(cache.profiles),
		updatedAt: new Date().toISOString(),
	};
	const cacheFile = getProfileCacheFile(
		getSelectorCacheDir(),
		normalizedCache.provider,
	);
	await writeFile(
		`${cacheFile}`,
		`${JSON.stringify(normalizedCache, null, 2)}\n`,
	).catch(() => {});
	await rm(path.join(getSelectorCacheDir(), normalizedCache.provider), {
		force: true,
		recursive: true,
	}).catch(() => {});
}

export async function readCachedProfile(
	provider: Provider,
	stage: SelectorStage,
	pageKey: string,
): Promise<SelectorProfile | null> {
	const cache = await readProviderCache(provider);
	if (!cache) {
		return null;
	}

	const normalizedPageKey = normalizePageKey(pageKey);
	return (
		cache.profiles.find(
			(profile) =>
				profile.stage === stage &&
				normalizePageKey(profile.pageKey) === normalizedPageKey,
		) ?? null
	);
}

export async function writeCachedProfile(profile: SelectorProfile): Promise<void> {
	const normalizedProfile = {
		...profile,
		pageKey: normalizePageKey(profile.pageKey),
	};
	const cache = (await readProviderCache(normalizedProfile.provider)) ?? {
		version: SELECTOR_PROFILE_VERSION,
		provider: normalizedProfile.provider,
		updatedAt: new Date().toISOString(),
		profiles: [],
	};
	cache.profiles = [
		...cache.profiles.filter(
			(entry) =>
				!(
					entry.stage === normalizedProfile.stage &&
					normalizePageKey(entry.pageKey) === normalizedProfile.pageKey
				),
		),
		normalizedProfile,
	];
	await writeProviderCache(cache);
}

export async function deleteCachedProfile(profile: SelectorProfile): Promise<void> {
	const normalizedPageKey = normalizePageKey(profile.pageKey);
	const cache = await readProviderCache(profile.provider);
	if (!cache) {
		return;
	}
	cache.profiles = cache.profiles.filter(
		(entry) =>
			!(
				entry.stage === profile.stage &&
				normalizePageKey(entry.pageKey) === normalizedPageKey
			),
	);
	if (cache.profiles.length === 0) {
		await unlink(
			getProfileCacheFile(getSelectorCacheDir(), profile.provider),
		).catch(() => {});
		await rm(path.join(getSelectorCacheDir(), profile.provider), {
			force: true,
			recursive: true,
		}).catch(() => {});
		return;
	}
	await writeProviderCache(cache);
}
