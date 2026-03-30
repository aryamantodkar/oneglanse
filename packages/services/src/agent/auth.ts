import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
	AUTH_PROVIDER_LIST,
	type AuthProvider,
	type Provider,
	type ProviderAuthStatus,
} from "@oneglanse/types";
import {
	AUTH_PROVIDER_CONFIG,
	AUTH_PROVIDER_DISPLAY,
	getAuthProviderForProvider,
} from "@oneglanse/utils";

type PersistedAuthStatus = {
	connecting: ProviderAuthStatus["connecting"];
	lastUpdatedAt: ProviderAuthStatus["lastUpdatedAt"];
	syncedAt: ProviderAuthStatus["syncedAt"];
	error: ProviderAuthStatus["error"];
};

type StorageState = {
	cookies?: Array<{
		name?: string;
		value?: string;
		domain?: string;
		path?: string;
		expires?: number;
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: "Strict" | "Lax" | "None";
	}>;
	origins?: Array<{
		origin?: string;
		localStorage?: Array<{ name: string; value: string }>;
	}>;
};

type RuntimeProfileMetadata = {
	provider: Provider;
	authProvider: AuthProvider;
	authStateHash: string;
	seededAt: string;
};

type RuntimeProfileSeedPlan = {
	authProvider: AuthProvider;
	authStateHash: string | null;
	authStatePath: string | null;
	shouldBootstrap: boolean;
	userDataDir: string;
};

const AGENT_RUNTIME_ENVIRONMENTS = ["local", "vps"] as const;
const DEFAULT_LOCAL_STORAGE_ROOT = ".oneglanse-storage";

function resolveMonorepoRoot(startDir = process.cwd()): string {
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

function getUploadConfig(): {
	url: string;
	token: string;
} | null {
	const url = process.env.AGENT_AUTH_UPLOAD_URL?.trim();
	const token = process.env.AGENT_AUTH_UPLOAD_TOKEN?.trim();
	if (!url && !token) {
		return null;
	}

	if (!url || !token) {
		throw new Error(
			"AGENT_AUTH_UPLOAD_URL and AGENT_AUTH_UPLOAD_TOKEN must be set together.",
		);
	}

	return { url, token };
}

function isRemoteSyncConfigured(): boolean {
	return getAgentRuntimeEnvironment() === "local" && getUploadConfig() !== null;
}

function getStorageRootDir(): string {
	if (getAgentRuntimeEnvironment() === "vps") {
		return "/storage";
	}

	return path.join(resolveMonorepoRoot(), DEFAULT_LOCAL_STORAGE_ROOT);
}

export function getAgentRuntimeEnvironment(): (typeof AGENT_RUNTIME_ENVIRONMENTS)[number] {
	return process.env.AGENT_RUNTIME_ENV === "vps" ? "vps" : "local";
}

export function isInteractiveAuthLaunchAllowed(): boolean {
	return getAgentRuntimeEnvironment() === "local";
}

export function getAgentAuthRootDir(): string {
	const configured = process.env.AGENT_AUTH_ROOT_DIR?.trim();
	if (configured) {
		return path.resolve(configured);
	}

	return path.join(getStorageRootDir(), "auth");
}

function getRuntimeRootDir(): string {
	return path.join(path.dirname(getAgentAuthRootDir()), "runtime");
}

function getSessionsDir(): string {
	return path.join(getAgentAuthRootDir(), "sessions");
}

function getConnectProfilesDir(): string {
	return path.join(getAgentAuthRootDir(), "connect");
}

function getStatusDir(): string {
	return path.join(getAgentAuthRootDir(), "status");
}

function matchesDomainSuffix(
	hostOrDomain: string,
	suffixes: string[],
): boolean {
	const normalized = hostOrDomain.replace(/^\./, "").toLowerCase();
	return suffixes.some(
		(suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
	);
}

function isValidSameSite(
	value: string | undefined,
): value is "Strict" | "Lax" | "None" {
	return value === "Strict" || value === "Lax" || value === "None";
}

function cookieStorageKey(cookie: {
	name: string;
	domain: string;
	path: string;
}): string {
	return `${cookie.domain}\u0000${cookie.path}\u0000${cookie.name}`;
}

function hashStorageState(state: StorageState): string {
	return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function compactStorageStateForProvider(
	provider: AuthProvider,
	state: StorageState,
): StorageState {
	const suffixes = AUTH_PROVIDER_CONFIG[provider].domainSuffixes;
	const cookies = new Map<
		string,
		NonNullable<StorageState["cookies"]>[number]
	>();

	for (const cookie of state.cookies ?? []) {
		const name = cookie.name?.trim();
		const value = cookie.value ?? "";
		const domain = cookie.domain?.trim();
		const cookiePath = cookie.path?.trim() || "/";
		const expires = typeof cookie.expires === "number" ? cookie.expires : -1;

		if (!name || !domain || !matchesDomainSuffix(domain, suffixes)) {
			continue;
		}

		if (expires > 0 && expires <= Date.now() / 1000) {
			continue;
		}

		const normalizedCookie = {
			name,
			value,
			domain,
			path: cookiePath,
			expires,
			httpOnly: Boolean(cookie.httpOnly),
			secure: Boolean(cookie.secure),
			...(isValidSameSite(cookie.sameSite)
				? { sameSite: cookie.sameSite }
				: {}),
		};

		cookies.set(cookieStorageKey(normalizedCookie), normalizedCookie);
	}

	const origins = new Map<
		string,
		NonNullable<StorageState["origins"]>[number]
	>();

	for (const originEntry of state.origins ?? []) {
		const origin = originEntry.origin?.trim();
		if (!origin) continue;

		try {
			if (!matchesDomainSuffix(new URL(origin).hostname, suffixes)) {
				continue;
			}
		} catch {
			continue;
		}

		const localStorage = new Map<string, string>();
		for (const item of originEntry.localStorage ?? []) {
			const name = item.name?.trim();
			if (!name) continue;
			localStorage.set(name, item.value ?? "");
		}

		if (localStorage.size === 0) {
			continue;
		}

		origins.set(origin, {
			origin,
			localStorage: [...localStorage.entries()]
				.map(([name, value]) => ({ name, value }))
				.sort((left, right) => left.name.localeCompare(right.name)),
		});
	}

	return {
		cookies: [...cookies.values()].sort((left, right) =>
			cookieStorageKey({
				name: left.name ?? "",
				domain: left.domain ?? "",
				path: left.path ?? "/",
			}).localeCompare(
				cookieStorageKey({
					name: right.name ?? "",
					domain: right.domain ?? "",
					path: right.path ?? "/",
				}),
			),
		),
		origins: [...origins.values()].sort((left, right) =>
			(left.origin ?? "").localeCompare(right.origin ?? ""),
		),
	};
}

function hasUsableAuthState(state: StorageState | null): boolean {
	if (!state) return false;
	return (state.cookies?.length ?? 0) > 0 || (state.origins?.length ?? 0) > 0;
}

async function readPersistedAuthStatus(
	provider: AuthProvider,
): Promise<PersistedAuthStatus | null> {
	try {
		const raw = await readFile(getAuthStatusFile(provider), "utf-8");
		return JSON.parse(raw) as PersistedAuthStatus;
	} catch {
		return null;
	}
}

async function readStorageStateFile(
	filePath: string,
): Promise<StorageState | null> {
	try {
		const raw = await readFile(filePath, "utf-8");
		return JSON.parse(raw) as StorageState;
	} catch {
		return null;
	}
}

async function getSessionUpdatedAt(
	provider: AuthProvider,
): Promise<string | null> {
	try {
		const metadata = await stat(getAuthSessionFile(provider));
		return metadata.mtime.toISOString();
	} catch {
		return null;
	}
}

async function readRuntimeProfileMetadata(
	provider: Provider,
): Promise<RuntimeProfileMetadata | null> {
	try {
		const raw = await readFile(
			getRuntimeProfileMetadataFile(provider),
			"utf-8",
		);
		return JSON.parse(raw) as RuntimeProfileMetadata;
	} catch {
		return null;
	}
}

async function writeRuntimeProfileMetadata(
	provider: Provider,
	metadata: RuntimeProfileMetadata,
): Promise<void> {
	const filePath = getRuntimeProfileMetadataFile(provider);
	mkdirSync(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(metadata, null, 2));
}

function deleteRuntimeProfileMetadata(provider: Provider): void {
	rmSync(getRuntimeProfileMetadataFile(provider), { force: true });
}

function clearRuntimeProfileDirectory(provider: Provider): void {
	rmSync(getProviderProfileDir(provider), { recursive: true, force: true });
}

async function getSpawnEnv(): Promise<NodeJS.ProcessEnv> {
	return {
		...process.env,
		AGENT_RUNTIME_ENV: getAgentRuntimeEnvironment(),
		AGENT_AUTH_ROOT_DIR: getAgentAuthRootDir(),
	};
}

async function resolveBuiltAuthCli(repoRoot: string): Promise<{
	command: string;
	args: string[];
}> {
	const builtCliPath = path.join(repoRoot, "apps/agent/dist/auth/cli.js");
	if (existsSync(builtCliPath)) {
		return {
			command: "node",
			args: [builtCliPath],
		};
	}

	return {
		command: "pnpm",
		args: [
			"exec",
			"node",
			"--loader",
			"ts-node/esm",
			"apps/agent/src/auth/cli.ts",
		],
	};
}

function buildPersistedStatus(
	status: Partial<PersistedAuthStatus>,
): PersistedAuthStatus {
	return {
		connecting: false,
		lastUpdatedAt: null,
		syncedAt: null,
		error: null,
		...status,
	};
}

export function getAuthSessionFile(provider: AuthProvider): string {
	return path.join(getSessionsDir(), provider, `${provider}-auth.json`);
}

export function getAuthProfileDir(provider: AuthProvider): string {
	return path.join(getConnectProfilesDir(), provider);
}

export function getProviderProfileDir(provider: Provider): string {
	return path.join(getRuntimeRootDir(), provider, "profile");
}

export function getRuntimeProfileMetadataFile(provider: Provider): string {
	return path.join(getRuntimeRootDir(), provider, "metadata.json");
}

export function getAuthStatusFile(provider: AuthProvider): string {
	return path.join(getStatusDir(), `${provider}.json`);
}

export function ensureAuthDirectories(): void {
	mkdirSync(getSessionsDir(), { recursive: true });
	mkdirSync(getConnectProfilesDir(), { recursive: true });
	mkdirSync(getStatusDir(), { recursive: true });
	mkdirSync(getRuntimeRootDir(), { recursive: true });
}

export async function readAuthSession(
	provider: AuthProvider,
): Promise<StorageState | null> {
	const rawState = await readStorageStateFile(getAuthSessionFile(provider));
	if (!rawState) return null;

	const compactState = compactStorageStateForProvider(provider, rawState);
	return hasUsableAuthState(compactState) ? compactState : null;
}

export async function writeProviderAuthStatus(
	provider: AuthProvider,
	status: PersistedAuthStatus,
): Promise<void> {
	ensureAuthDirectories();
	const statusFile = getAuthStatusFile(provider);
	mkdirSync(path.dirname(statusFile), { recursive: true });
	await writeFile(
		statusFile,
		JSON.stringify(buildPersistedStatus(status), null, 2),
	);
}

export async function invalidateRuntimeProfilesForAuthProvider(
	authProvider: AuthProvider,
): Promise<void> {
	for (const provider of AUTH_PROVIDER_CONFIG[authProvider].providers) {
		deleteRuntimeProfileMetadata(provider);
	}
}

export async function saveAuthSession(
	provider: AuthProvider,
	state: StorageState,
): Promise<StorageState> {
	ensureAuthDirectories();
	const compactState = compactStorageStateForProvider(provider, state);

	if (!hasUsableAuthState(compactState)) {
		throw new Error(
			`${AUTH_PROVIDER_DISPLAY[provider].displayName} session did not contain usable cookies or origins.`,
		);
	}

	const now = new Date().toISOString();
	const sessionFile = getAuthSessionFile(provider);
	mkdirSync(path.dirname(sessionFile), { recursive: true });
	await writeFile(sessionFile, JSON.stringify(compactState));
	await invalidateRuntimeProfilesForAuthProvider(provider);
	await writeProviderAuthStatus(provider, {
		connecting: false,
		lastUpdatedAt: now,
		syncedAt: isRemoteSyncConfigured() ? null : now,
		error: null,
	});

	return compactState;
}

export async function uploadAuthSession(
	provider: AuthProvider,
	state?: StorageState,
): Promise<void> {
	if (getAgentRuntimeEnvironment() !== "local") {
		return;
	}

	const uploadConfig = getUploadConfig();
	if (!uploadConfig) {
		return;
	}

	const payloadState = state ?? (await readAuthSession(provider));
	if (!hasUsableAuthState(payloadState)) {
		throw new Error(
			`${AUTH_PROVIDER_DISPLAY[provider].displayName} session is missing or invalid.`,
		);
	}

	const response = await fetch(uploadConfig.url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Encoding": "gzip",
			Authorization: `Bearer ${uploadConfig.token}`,
		},
		body: gzipSync(
			JSON.stringify({
				provider,
				session: payloadState,
			}),
		),
	});

	if (!response.ok) {
		throw new Error(
			`Auth session upload failed (${response.status}): ${await response.text()}`,
		);
	}

	await writeProviderAuthStatus(provider, {
		...(await readPersistedAuthStatus(provider)),
		connecting: false,
		lastUpdatedAt: new Date().toISOString(),
		syncedAt: new Date().toISOString(),
		error: null,
	});
}

export async function readProviderAuthStatuses(): Promise<
	ProviderAuthStatus[]
> {
	ensureAuthDirectories();
	const remoteSyncConfigured = isRemoteSyncConfigured();

	return Promise.all(
		AUTH_PROVIDER_LIST.map(async (provider) => {
			const [storedStatus, sessionState, sessionUpdatedAt] = await Promise.all([
				readPersistedAuthStatus(provider),
				readAuthSession(provider),
				getSessionUpdatedAt(provider),
			]);
			const connected = hasUsableAuthState(sessionState);
			const syncedAt =
				connected && !remoteSyncConfigured
					? (storedStatus?.syncedAt ?? sessionUpdatedAt)
					: (storedStatus?.syncedAt ?? null);

			return {
				provider,
				connected,
				connecting: storedStatus?.connecting ?? false,
				synced: connected && Boolean(syncedAt),
				lastUpdatedAt: sessionUpdatedAt ?? storedStatus?.lastUpdatedAt ?? null,
				syncedAt,
				error: storedStatus?.error ?? null,
			} satisfies ProviderAuthStatus;
		}),
	);
}

export function getAuthProviderForRuntimeProvider(
	provider: Provider,
): AuthProvider {
	return getAuthProviderForProvider(provider);
}

export async function getRuntimeProfileSeedPlan(
	provider: Provider,
): Promise<RuntimeProfileSeedPlan> {
	ensureAuthDirectories();

	const authProvider = getAuthProviderForRuntimeProvider(provider);
	const userDataDir = getProviderProfileDir(provider);
	const authState = await readAuthSession(authProvider);
	const authStateHash = authState ? hashStorageState(authState) : null;
	const authStatePath =
		authStateHash && existsSync(getAuthSessionFile(authProvider))
			? getAuthSessionFile(authProvider)
			: null;
	const metadata = await readRuntimeProfileMetadata(provider);
	const shouldBootstrap =
		Boolean(authStateHash && authStatePath) &&
		(!metadata ||
			metadata.authStateHash !== authStateHash ||
			!existsSync(userDataDir));

	return {
		authProvider,
		authStateHash,
		authStatePath,
		shouldBootstrap,
		userDataDir,
	};
}

export async function markRuntimeProfileSeeded(
	provider: Provider,
	authStateHash: string,
): Promise<void> {
	await writeRuntimeProfileMetadata(provider, {
		provider,
		authProvider: getAuthProviderForRuntimeProvider(provider),
		authStateHash,
		seededAt: new Date().toISOString(),
	});
}

export function prepareRuntimeProfileBootstrap(provider: Provider): void {
	clearRuntimeProfileDirectory(provider);
	deleteRuntimeProfileMetadata(provider);
}

export async function spawnProviderAuthLogin(
	provider: AuthProvider,
): Promise<{ started: boolean }> {
	if (!isInteractiveAuthLaunchAllowed()) {
		throw new Error(
			"Interactive provider login is disabled on VPS. Open the same provider-connections screen locally and configure AGENT_AUTH_UPLOAD_URL/AGENT_AUTH_UPLOAD_TOKEN to sync sessions to the VPS.",
		);
	}

	const existing = await readPersistedAuthStatus(provider);
	if (existing?.connecting) {
		return { started: false };
	}

	ensureAuthDirectories();
	await writeProviderAuthStatus(provider, {
		connecting: true,
		lastUpdatedAt: new Date().toISOString(),
		syncedAt: existing?.syncedAt ?? null,
		error: null,
	});

	const repoRoot = resolveMonorepoRoot();
	const { command, args } = await resolveBuiltAuthCli(repoRoot);
	const child = spawn(command, [...args, "--provider", provider], {
		cwd: repoRoot,
		env: await getSpawnEnv(),
		detached: true,
		stdio: "ignore",
	});

	child.unref();
	return { started: true };
}

export function getAuthProviderCards(): Array<{
	provider: AuthProvider;
	displayName: string;
	connectLabel: string;
	domain: string;
	providers: Provider[];
}> {
	return AUTH_PROVIDER_LIST.map((provider) => ({
		provider,
		displayName: AUTH_PROVIDER_DISPLAY[provider].displayName,
		connectLabel: AUTH_PROVIDER_CONFIG[provider].connectLabel,
		domain: AUTH_PROVIDER_DISPLAY[provider].domain,
		providers: [...AUTH_PROVIDER_CONFIG[provider].providers],
	}));
}

export function getAuthModuleState() {
	return {
		interactiveConnectAllowed: isInteractiveAuthLaunchAllowed(),
		remoteSyncConfigured: isRemoteSyncConfigured(),
	};
}
