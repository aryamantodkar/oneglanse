import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";

const PROFILES_ROOT = "/storage/profiles";
const PROFILE_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
const METADATA_FILE = ".profile-meta.json";

type ProfileMetadata = {
	createdAt: number;
	lastUsedAt: number;
	proxyIdentity: string;
	provider: string;
	warmedUp: boolean;
};

function hashProxyIdentity(proxyUrl: string): string {
	try {
		const parsed = new URL(proxyUrl);
		const authority = `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
		return createHash("sha256").update(authority).digest("hex").slice(0, 16);
	} catch {
		return createHash("sha256").update(proxyUrl).digest("hex").slice(0, 16);
	}
}

function getProfileDir(provider: Provider, proxyUrl: string): string {
	const ipHash = hashProxyIdentity(proxyUrl);
	return join(PROFILES_ROOT, provider, ipHash);
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

export async function resolveProfileDir(
	provider: Provider,
	proxyUrl: string | null,
): Promise<{ dir: string; isNew: boolean }> {
	if (!proxyUrl) {
		// No proxy — use a temp dir (no persistence without stable IP)
		const dir = `/tmp/cdp-${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		mkdirSync(dir, { recursive: true });
		return { dir, isNew: true };
	}

	const profileDir = getProfileDir(provider, proxyUrl);

	const meta = await readMetadata(profileDir);
	const now = Date.now();

	if (meta) {
		const age = now - meta.createdAt;
		const proxyChanged = meta.proxyIdentity !== hashProxyIdentity(proxyUrl);

		if (age > PROFILE_MAX_AGE_MS || proxyChanged) {
			logger.log(
				`profile expired (age=${Math.round(age / 3600000)}h) or proxy changed — rotating`,
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
		proxyIdentity: hashProxyIdentity(proxyUrl),
		provider,
		warmedUp: false,
	});

	logger.log(`created new profile for ${provider}`);
	return { dir: profileDir, isNew: true };
}

export async function markProfileWarmed(
	provider: Provider,
	proxyUrl: string,
): Promise<void> {
	const profileDir = getProfileDir(provider, proxyUrl);
	const meta = await readMetadata(profileDir);
	if (meta) {
		meta.warmedUp = true;
		await writeMetadata(profileDir, meta);
	}
}

export async function isProfileWarmed(
	provider: Provider,
	proxyUrl: string,
): Promise<boolean> {
	const profileDir = getProfileDir(provider, proxyUrl);
	const meta = await readMetadata(profileDir);
	return meta?.warmedUp ?? false;
}

export async function cleanExpiredProfiles(): Promise<void> {
	if (!existsSync(PROFILES_ROOT)) return;

	const now = Date.now();
	let cleaned = 0;

	for (const providerDir of readdirSync(PROFILES_ROOT)) {
		const providerPath = join(PROFILES_ROOT, providerDir);
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
