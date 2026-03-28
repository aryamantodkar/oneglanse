import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";

const PERSISTENT_PROFILES_ROOT = "/storage/profiles";
const FALLBACK_PROFILES_ROOT = "/tmp/oneglanse-profiles";
// With proxy-session-scoped profile identities (one profile per sticky session),
// each 10-minute rotation creates a new profile directory. Keeping them for 48h
// would accumulate 288 orphaned directories per provider. 2 hours = 12 rotations
// max on disk at any time, which is well within acceptable disk usage.
const PROFILE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const METADATA_FILE = ".profile-meta.json";
const STORAGE_STATE_FILE = ".storage-state.json";
const BROWSER_PROFILE_LOCK_FILES = [
	"SingletonCookie",
	"SingletonLock",
	"SingletonSocket",
	"DevToolsActivePort",
	"lock",
	".parentlock",
	"parent.lock",
];
let cachedProfilesRoot: string | null = null;
let profilesRootPromise: Promise<string> | null = null;

type ProfileMetadata = {
	createdAt: number;
	lastUsedAt: number;
	profileIdentity: string;
	provider: string;
	warmedUp: boolean;
};

function hashProfileIdentity(profileIdentity: string): string {
	// Hash the raw identity string directly. The previous URL-parsing approach
	// was intended to normalise session URLs, but it silently collapsed all
	// proxy identities (e.g. "proxy:1.2.3.4:10001:user") to the same hash:
	// new URL("proxy:...") treats "proxy" as an opaque scheme, leaving hostname=""
	// and port="" — so every proxy mapped to authority "proxy://:".
	return createHash("sha256").update(profileIdentity).digest("hex").slice(0, 16);
}

async function resolveProfilesRoot(): Promise<string> {
	if (cachedProfilesRoot) {
		return cachedProfilesRoot;
	}

	if (!profilesRootPromise) {
		profilesRootPromise = (async () => {
			try {
				mkdirSync(PERSISTENT_PROFILES_ROOT, { recursive: true });
				await writeFile(
					join(PERSISTENT_PROFILES_ROOT, ".write-test"),
					String(Date.now()),
				);
				await rm(join(PERSISTENT_PROFILES_ROOT, ".write-test"), {
					force: true,
				}).catch(() => null);
				cachedProfilesRoot = PERSISTENT_PROFILES_ROOT;
				return cachedProfilesRoot;
			} catch (error) {
				mkdirSync(FALLBACK_PROFILES_ROOT, { recursive: true });
				cachedProfilesRoot = FALLBACK_PROFILES_ROOT;
				logger.warn(
					`profiles root ${PERSISTENT_PROFILES_ROOT} is not writable, falling back to ${FALLBACK_PROFILES_ROOT}: ${error instanceof Error ? error.message : String(error)}`,
				);
				return cachedProfilesRoot;
			}
		})().finally(() => {
			profilesRootPromise = null;
		});
	}

	return profilesRootPromise;
}

async function getProfileDir(
	profileScope: string,
	profileIdentity: string,
): Promise<string> {
	const identityHash = hashProfileIdentity(profileIdentity);
	const profilesRoot = await resolveProfilesRoot();
	return join(profilesRoot, profileScope, identityHash);
}

export async function getProfileStorageStatePath(
	profileScope: string,
	profileIdentity: string,
): Promise<string> {
	const profileDir = await getProfileDir(profileScope, profileIdentity);
	return join(profileDir, STORAGE_STATE_FILE);
}

export async function hasProfileStorageState(
	profileScope: string,
	profileIdentity: string,
): Promise<boolean> {
	const statePath = await getProfileStorageStatePath(
		profileScope,
		profileIdentity,
	);
	return existsSync(statePath);
}

async function readMetadata(
	profileDir: string,
): Promise<ProfileMetadata | null> {
	const metaPath = join(profileDir, METADATA_FILE);
	try {
		const raw = await readFile(metaPath, "utf-8");
		return JSON.parse(raw) as ProfileMetadata;
	} catch {
		return null;
	}
}

async function writeMetadata(
	profileDir: string,
	meta: ProfileMetadata,
): Promise<void> {
	const metaPath = join(profileDir, METADATA_FILE);
	await writeFile(metaPath, JSON.stringify(meta, null, 2));
}

export async function clearBrowserProfileLocks(
	profileDir: string,
): Promise<void> {
	await Promise.all(
		BROWSER_PROFILE_LOCK_FILES.map((file) =>
			rm(join(profileDir, file), { force: true }).catch(() => null),
		),
	);
}

export async function resolveProfileDir(
	provider: Provider,
	profileIdentity: string | null,
	profileScope?: string,
): Promise<{ dir: string; isNew: boolean }> {
	if (!profileIdentity) {
		// No session identity — use a temp dir.
		const dir = `/tmp/browser-session-${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		mkdirSync(dir, { recursive: true });
		return { dir, isNew: true };
	}

	const profileDir = await getProfileDir(
		profileScope ?? provider,
		profileIdentity,
	);

	const meta = await readMetadata(profileDir);
	const now = Date.now();

	if (meta) {
		const age = now - meta.createdAt;
		const identityChanged =
			meta.profileIdentity !== hashProfileIdentity(profileIdentity);

		if (age > PROFILE_MAX_AGE_MS || identityChanged) {
			logger.log(
				`profile expired (age=${Math.round(age / 3600000)}h) or session identity changed — rotating`,
			);
			await rm(profileDir, { recursive: true, force: true }).catch(() => null);
		} else {
			// Reuse existing profile
			meta.lastUsedAt = now;
			await writeMetadata(profileDir, meta);
			logger.log(
				`reusing profile for ${provider} (age=${Math.round(age / 60000)}min, warmed=${meta.warmedUp})`,
			);
			return { dir: profileDir, isNew: false };
		}
	}

	// Create new profile
	mkdirSync(profileDir, { recursive: true });
	await writeMetadata(profileDir, {
		createdAt: now,
		lastUsedAt: now,
		profileIdentity: hashProfileIdentity(profileIdentity),
		provider,
		warmedUp: false,
	});

	logger.log(`created new profile for ${provider}`);
	return { dir: profileDir, isNew: true };
}

export async function markProfileWarmed(
	provider: Provider,
	profileIdentity: string,
	profileScope?: string,
): Promise<void> {
	const profileDir = await getProfileDir(
		profileScope ?? provider,
		profileIdentity,
	);
	const meta = await readMetadata(profileDir);
	if (meta) {
		meta.warmedUp = true;
		await writeMetadata(profileDir, meta);
	}
}

export async function isProfileWarmed(
	provider: Provider,
	profileIdentity: string,
	profileScope?: string,
): Promise<boolean> {
	const profileDir = await getProfileDir(
		profileScope ?? provider,
		profileIdentity,
	);
	const meta = await readMetadata(profileDir);
	return meta?.warmedUp ?? false;
}

export async function cleanExpiredProfiles(): Promise<void> {
	const profilesRoot = await resolveProfilesRoot();
	if (!existsSync(profilesRoot)) return;

	const now = Date.now();
	let cleaned = 0;

	for (const providerDir of readdirSync(profilesRoot)) {
		const providerPath = join(profilesRoot, providerDir);
		if (!statSync(providerPath).isDirectory()) continue;

		for (const profileHash of readdirSync(providerPath)) {
			const profilePath = join(providerPath, profileHash);
			if (!statSync(profilePath).isDirectory()) continue;

			const meta = await readMetadata(profilePath);
			if (!meta || now - meta.createdAt > PROFILE_MAX_AGE_MS) {
				await rm(profilePath, { recursive: true, force: true }).catch(
					() => null,
				);
				cleaned++;
			}
		}
	}

	if (cleaned > 0) {
		logger.log(`cleaned ${cleaned} expired browser profile(s)`);
	}
}
