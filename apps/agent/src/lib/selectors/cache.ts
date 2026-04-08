import { existsSync, mkdirSync } from "node:fs";
import { readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
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

export function sanitizeFilename(input: string): string {
	return (
		input.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "root"
	);
}


export function getProfileCacheFile(cacheDir: string, provider: Provider): string {
	return path.join(cacheDir, `${provider}.json`);
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

export async function readSelectorProfileFile(
	cacheFile: string,
	provider: Provider,
	stage: SelectorStage,
	pageKey?: string,
): Promise<SelectorProfile | null> {
	if (!existsSync(cacheFile)) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			await readFile(cacheFile, "utf8"),
		) as SelectorProfile;
		const normalizedPageKey = normalizePageKey(parsed.pageKey);
		if (
			parsed.version !== SELECTOR_PROFILE_VERSION ||
			parsed.provider !== provider ||
			parsed.stage !== stage ||
			(pageKey !== undefined && normalizedPageKey !== normalizePageKey(pageKey))
		) {
			return null;
		}
		return {
			...parsed,
			pageKey: normalizedPageKey,
		};
	} catch {
		return null;
	}
}

export async function readLegacyProviderProfiles(
	provider: Provider,
): Promise<SelectorProfile[]> {
	const providerDir = path.join(getSelectorCacheDir(), provider);
	const profiles: SelectorProfile[] = [];

	if (!existsSync(providerDir)) {
		return [];
	}

	for (const stage of await readdir(providerDir).catch(() => [])) {
		const stageDir = path.join(providerDir, stage);
		for (const file of await readdir(stageDir).catch(() => [])) {
			if (!file.endsWith(".json")) {
				continue;
			}
			const parsed = await readSelectorProfileFile(
				path.join(stageDir, file),
				provider,
				stage as SelectorStage,
			);
			if (parsed) {
				profiles.push(parsed);
			}
		}
	}

	return dedupeProfiles(profiles);
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
			return {
				...parsed,
				profiles: dedupeProfiles(parsed.profiles),
			};
		} catch {
			return null;
		}
	}

	const legacyProfiles = await readLegacyProviderProfiles(provider);
	if (legacyProfiles.length === 0) {
		return null;
	}

	return {
		version: SELECTOR_PROFILE_VERSION,
		provider,
		updatedAt:
			legacyProfiles
				.map((profile) => profile.createdAt)
				.sort()
				.at(-1) ?? new Date().toISOString(),
		profiles: legacyProfiles,
	};
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
