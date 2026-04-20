import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
	AUTH_PROVIDER_LIST,
	type AppMode,
	type AuthProvider,
	PROVIDER_LIST,
	type Provider,
	type ProviderAuthStatus,
	isInteractiveAuthAllowedInMode,
	resolveAppMode,
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
	launcherPid?: number | null;
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
	authState: StorageState | null;
	authStateHash: string | null;
	authStatePath: string | null;
	shouldBootstrap: boolean;
	userDataDir: string;
};

type ReusableIdentityProvider = "google" | "apple" | "facebook";

const DEFAULT_LOCAL_STORAGE_ROOT = ".oneglanse-storage";
const authLaunchInFlight = new Set<AuthProvider>();
const REUSABLE_IDENTITY_PROVIDER_CONFIG: Record<
	ReusableIdentityProvider,
	{
		domainSuffixes: string[];
		preferredAuthProvider?: AuthProvider;
	}
> = {
	google: {
		domainSuffixes: ["google.com", "googleusercontent.com", "gstatic.com"],
		preferredAuthProvider: "google",
	},
	apple: {
		domainSuffixes: [
			"apple.com",
			"apple-cloudkit.com",
			"apple-dns.net",
			"icloud.com",
		],
	},
	facebook: {
		domainSuffixes: ["facebook.com", "facebook.net", "fb.com", "fbsbx.com"],
	},
};
const REUSABLE_IDENTITY_PROVIDERS = Object.keys(
	REUSABLE_IDENTITY_PROVIDER_CONFIG,
) as ReusableIdentityProvider[];

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
	return getAppMode() === "local" && getUploadConfig() !== null;
}

function getStorageRootDir(): string {
	if (getAppMode() !== "local") {
		return "/storage";
	}

	return path.join(resolveMonorepoRoot(), DEFAULT_LOCAL_STORAGE_ROOT);
}

export function getAppMode(): AppMode {
	return resolveAppMode(process.env.ONEGLANSE_APP_MODE);
}

export function isInteractiveAuthLaunchAllowed(): boolean {
	return isInteractiveAuthAllowedInMode(getAppMode());
}

export function getAgentAuthRootDir(): string {
	const configured = process.env.AGENT_AUTH_ROOT_DIR?.trim();
	if (configured) {
		return path.resolve(configured);
	}

	return path.join(getStorageRootDir(), "auth");
}

export function getAuthStorageDiagnostics(): {
	appMode: AppMode;
	storageRootDir: string;
	authRootDir: string;
	storageRootExists: boolean;
	authRootExists: boolean;
	sessionsDirExists: boolean;
	statusDirExists: boolean;
} {
	const authRootDir = getAgentAuthRootDir();
	const storageRootDir = path.dirname(authRootDir);

	return {
		appMode: getAppMode(),
		storageRootDir,
		authRootDir,
		storageRootExists: existsSync(storageRootDir),
		authRootExists: existsSync(authRootDir),
		sessionsDirExists: existsSync(getSessionsDir()),
		statusDirExists: existsSync(getStatusDir()),
	};
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

function getReusableIdentityDir(): string {
	return path.join(getAgentAuthRootDir(), "identities");
}

function matchesDomainSuffix(
	hostOrDomain: string,
	suffixes: readonly string[],
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

function sortStorageState(state: StorageState): StorageState {
	return {
		cookies: [...(state.cookies ?? [])].sort((left, right) =>
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
		origins: [...(state.origins ?? [])].sort((left, right) =>
			(left.origin ?? "").localeCompare(right.origin ?? ""),
		),
	};
}

function getReusableIdentityConfig(provider: ReusableIdentityProvider) {
	return REUSABLE_IDENTITY_PROVIDER_CONFIG[provider];
}

function compactReusableIdentityState(
	provider: ReusableIdentityProvider,
	state: StorageState,
): StorageState {
	return compactStorageStateByDomainSuffixes(
		state,
		getReusableIdentityConfig(provider).domainSuffixes,
	);
}

async function readReusableIdentityState(
	provider: ReusableIdentityProvider,
): Promise<StorageState | null> {
	return readStorageStateFile(getReusableIdentitySessionFile(provider));
}

function compactStorageStateByDomainSuffixes(
	state: StorageState,
	suffixes: readonly string[],
): StorageState {
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
		...sortStorageState({
			cookies: [...cookies.values()],
			origins: [...origins.values()],
		}),
	};
}

function compactStorageStateForProvider(
	provider: AuthProvider,
	state: StorageState,
): StorageState {
	return compactStorageStateByDomainSuffixes(
		state,
		AUTH_PROVIDER_CONFIG[provider].domainSuffixes,
	);
}

function mergeStorageStates(states: StorageState[]): StorageState {
	const cookies = new Map<
		string,
		NonNullable<StorageState["cookies"]>[number]
	>();
	const origins = new Map<
		string,
		NonNullable<StorageState["origins"]>[number]
	>();

	for (const state of states) {
		for (const cookie of state.cookies ?? []) {
			const name = cookie.name?.trim();
			const domain = cookie.domain?.trim();
			const cookiePath = cookie.path?.trim() || "/";
			if (!name || !domain) {
				continue;
			}

			const normalizedCookie = {
				name,
				value: cookie.value ?? "",
				domain,
				path: cookiePath,
				expires: typeof cookie.expires === "number" ? cookie.expires : -1,
				httpOnly: Boolean(cookie.httpOnly),
				secure: Boolean(cookie.secure),
				...(isValidSameSite(cookie.sameSite)
					? { sameSite: cookie.sameSite }
					: {}),
			};
			cookies.set(cookieStorageKey(normalizedCookie), normalizedCookie);
		}

		for (const originEntry of state.origins ?? []) {
			const origin = originEntry.origin?.trim();
			if (!origin) {
				continue;
			}

			const mergedLocalStorage = new Map<string, string>();
			for (const existing of origins.get(origin)?.localStorage ?? []) {
				const name = existing.name?.trim();
				if (!name) continue;
				mergedLocalStorage.set(name, existing.value ?? "");
			}

			for (const item of originEntry.localStorage ?? []) {
				const name = item.name?.trim();
				if (!name) continue;
				mergedLocalStorage.set(name, item.value ?? "");
			}

			if (mergedLocalStorage.size === 0) {
				continue;
			}

			origins.set(origin, {
				origin,
				localStorage: [...mergedLocalStorage.entries()]
					.map(([name, value]) => ({ name, value }))
					.sort((left, right) => left.name.localeCompare(right.name)),
			});
		}
	}

	return sortStorageState({
		cookies: [...cookies.values()],
		origins: [...origins.values()],
	});
}

function hasUsableAuthState(state: StorageState | null): boolean {
	if (!state) return false;
	return (state.cookies?.length ?? 0) > 0 || (state.origins?.length ?? 0) > 0;
}

export async function readPersistedAuthStatus(
	provider: AuthProvider,
): Promise<PersistedAuthStatus | null> {
	try {
		const raw = await readFile(getAuthStatusFile(provider), "utf-8");
		return JSON.parse(raw) as PersistedAuthStatus;
	} catch {
		return null;
	}
}

function isProcessAlive(pid: number | null | undefined): boolean {
	if (!pid || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
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
	const spawnEnv: NodeJS.ProcessEnv = {
		...process.env,
		ONEGLANSE_APP_MODE: getAppMode(),
		AGENT_AUTH_ROOT_DIR: getAgentAuthRootDir(),
	};

	if (!spawnEnv.CAMOUFOX_ENABLE_CACHE) {
		spawnEnv.CAMOUFOX_ENABLE_CACHE = "true";
	}
	spawnEnv.CAMOUFOX_CONFIG_JSON = undefined;
	spawnEnv.CAMOUFOX_EXTRA_LAUNCH_JSON = undefined;
	spawnEnv.CAMOUFOX_FIREFOX_USER_PREFS_JSON = undefined;
	spawnEnv.CAMOUFOX_FINGERPRINT_JSON = undefined;
	spawnEnv.CAMOUFOX_FINGERPRINT_PRESET = undefined;
	spawnEnv.CAMOUFOX_ADDONS = undefined;
	spawnEnv.CAMOUFOX_EXCLUDE_ADDONS = undefined;
	spawnEnv.CAMOUFOX_FONTS = undefined;
	spawnEnv.CAMOUFOX_GEOIP = undefined;
	spawnEnv.CAMOUFOX_GEOIP_DB = undefined;
	spawnEnv.CAMOUFOX_LOCALE = undefined;
	spawnEnv.CAMOUFOX_OS = undefined;
	spawnEnv.CAMOUFOX_WEBGL_CONFIG = undefined;
	spawnEnv.CAMOUFOX_ARGS = undefined;
	spawnEnv.CAMOUFOX_ENV_JSON = undefined;

	return spawnEnv;
}

async function resolveBuiltAuthCli(repoRoot: string): Promise<{
	command: string;
	args: string[];
	cwd: string;
}> {
	const agentAppDir = path.join(repoRoot, "apps/agent");

	if (getAppMode() === "local") {
		return {
			command: "pnpm",
			args: ["exec", "node", "--loader", "ts-node/esm", "src/auth/cli.ts"],
			cwd: agentAppDir,
		};
	}

	const builtCliPath = path.join(repoRoot, "apps/agent/dist/auth/cli.js");
	if (existsSync(builtCliPath)) {
		return {
			command: "node",
			args: [builtCliPath],
			cwd: repoRoot,
		};
	}

	return {
		command: "pnpm",
		args: ["exec", "node", "--loader", "ts-node/esm", "src/auth/cli.ts"],
		cwd: agentAppDir,
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
		launcherPid: null,
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

function getReusableIdentitySessionFile(
	provider: ReusableIdentityProvider,
): string {
	return path.join(getReusableIdentityDir(), `${provider}.json`);
}

export function ensureAuthDirectories(): void {
	mkdirSync(getSessionsDir(), { recursive: true });
	mkdirSync(getConnectProfilesDir(), { recursive: true });
	mkdirSync(getStatusDir(), { recursive: true });
	mkdirSync(getReusableIdentityDir(), { recursive: true });
	mkdirSync(getRuntimeRootDir(), { recursive: true });
}

export function getReusableIdentityDomainSuffixes(): string[] {
	return [
		...new Set(
			REUSABLE_IDENTITY_PROVIDERS.flatMap(
				(provider) => getReusableIdentityConfig(provider).domainSuffixes,
			),
		),
	];
}

export async function readReusableIdentitySeedState(): Promise<StorageState | null> {
	const states = (
		await Promise.all(
			REUSABLE_IDENTITY_PROVIDERS.map(async (provider) => {
				const rawState = await readReusableIdentityState(provider);
				const preferredAuthProvider =
					getReusableIdentityConfig(provider).preferredAuthProvider;
				const preferredAuthState = preferredAuthProvider
					? await readAuthSession(preferredAuthProvider)
					: null;
				const candidateStates = [rawState, preferredAuthState]
					.filter((state): state is StorageState => state !== null)
					.map((state) => compactReusableIdentityState(provider, state))
					.filter((state) => hasUsableAuthState(state));

				if (candidateStates.length === 0) {
					return null;
				}

				const compactState = mergeStorageStates(candidateStates);
				return hasUsableAuthState(compactState) ? compactState : null;
			}),
		)
	).filter((state): state is StorageState => state !== null);

	if (states.length === 0) {
		return null;
	}

	const mergedState = mergeStorageStates(states);
	return hasUsableAuthState(mergedState) ? mergedState : null;
}

export async function readAuthLaunchSeedState(
	provider: AuthProvider,
): Promise<StorageState | null> {
	const [providerState, reusableState] = await Promise.all([
		readAuthSession(provider),
		readReusableIdentitySeedState(),
	]);

	// Reusable identity state first, provider state last — last entry wins on
	// cookie key conflicts, so the provider's own saved session always takes
	// precedence over the shared Google/OAuth identity state.
	const candidates = [reusableState, providerState].filter(
		(s): s is StorageState => hasUsableAuthState(s),
	);
	if (candidates.length === 0) return null;

	const merged = mergeStorageStates(candidates);
	return hasUsableAuthState(merged) ? merged : null;
}

export async function saveReusableIdentitySessions(
	state: StorageState,
): Promise<ReusableIdentityProvider[]> {
	ensureAuthDirectories();

	const savedProviders: ReusableIdentityProvider[] = [];
	for (const provider of REUSABLE_IDENTITY_PROVIDERS) {
		const incomingState = compactReusableIdentityState(provider, state);
		if (!hasUsableAuthState(incomingState)) {
			continue;
		}

		const existingState = await readReusableIdentityState(provider);
		const nextState = hasUsableAuthState(existingState)
			? mergeStorageStates([existingState as StorageState, incomingState])
			: incomingState;

		await writeFile(
			getReusableIdentitySessionFile(provider),
			JSON.stringify(nextState),
		);
		savedProviders.push(provider);
	}

	return savedProviders;
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
		launcherPid: null,
	});

	return compactState;
}

export async function resetProviderAuthData(
	provider: AuthProvider,
): Promise<void> {
	ensureAuthDirectories();

	rmSync(getAuthSessionFile(provider), { force: true });
	rmSync(getAuthProfileDir(provider), { recursive: true, force: true });

	for (const runtimeProvider of AUTH_PROVIDER_CONFIG[provider].providers) {
		prepareRuntimeProfileBootstrap(runtimeProvider);
	}

	await writeProviderAuthStatus(provider, {
		connecting: false,
		lastUpdatedAt: new Date().toISOString(),
		syncedAt: null,
		error: null,
		launcherPid: null,
	});
}

export async function uploadAuthSession(
	provider: AuthProvider,
	state?: StorageState,
): Promise<void> {
	if (getAppMode() !== "local") {
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
		launcherPid: null,
	});
}

export async function readProviderAuthStatuses(): Promise<
	ProviderAuthStatus[]
> {
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
				connecting:
					Boolean(storedStatus?.connecting) &&
					isProcessAlive(storedStatus?.launcherPid),
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

export async function isAuthProviderReady(
	provider: AuthProvider,
): Promise<boolean> {
	const [storedStatus, sessionState] = await Promise.all([
		readPersistedAuthStatus(provider),
		readAuthSession(provider),
	]);
	const hasAuthFile = existsSync(getAuthSessionFile(provider));
	const browserStillOpen =
		Boolean(storedStatus?.connecting) &&
		isProcessAlive(storedStatus?.launcherPid);

	return hasAuthFile && hasUsableAuthState(sessionState) && !browserStillOpen;
}

export async function hasRuntimeProviderAuth(
	provider: Provider,
): Promise<boolean> {
	const authProvider = getAuthProviderForRuntimeProvider(provider);
	return isAuthProviderReady(authProvider);
}

export async function readAuthenticatedRuntimeProviders(
	providers: readonly Provider[] = PROVIDER_LIST,
): Promise<Provider[]> {
	const uniqueProviders = [...new Set(providers)];
	const authStates = await Promise.all(
		uniqueProviders.map(async (provider) => ({
			provider,
			hasAuth: await hasRuntimeProviderAuth(provider),
		})),
	);

	return authStates
		.filter(
			(entry): entry is { provider: Provider; hasAuth: true } => entry.hasAuth,
		)
		.map((entry) => entry.provider);
}

export async function getRuntimeProfileSeedPlan(
	provider: Provider,
): Promise<RuntimeProfileSeedPlan> {
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
		authState,
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

async function waitForAuthLoginStartup(
	child: ReturnType<typeof spawn>,
	timeoutMs = 2_000,
): Promise<Error | null> {
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			resolve(null);
		}, timeoutMs);

		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(error instanceof Error ? error : new Error(String(error)));
		});

		child.once("exit", (code, signal) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(
				new Error(
					`Provider auth launcher exited early with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}.`,
				),
			);
		});
	});
}

export async function spawnProviderAuthLogin(
	provider: AuthProvider,
): Promise<{ started: boolean }> {
	if (!isInteractiveAuthLaunchAllowed()) {
		throw new Error(
			"Interactive provider login is disabled in this environment. Open the local Providers screen and configure AGENT_AUTH_UPLOAD_URL/AGENT_AUTH_UPLOAD_TOKEN to sync sessions here.",
		);
	}

	if (authLaunchInFlight.has(provider)) {
		return { started: false };
	}

	authLaunchInFlight.add(provider);

	try {
		const existing = await readPersistedAuthStatus(provider);
		if (existing?.connecting) {
			if (isProcessAlive(existing.launcherPid)) {
				return { started: false };
			}

			await writeProviderAuthStatus(provider, {
				...existing,
				connecting: false,
				launcherPid: null,
			});
		}

		ensureAuthDirectories();
		await writeProviderAuthStatus(provider, {
			connecting: true,
			lastUpdatedAt: new Date().toISOString(),
			syncedAt: existing?.syncedAt ?? null,
			error: null,
			launcherPid: null,
		});

		const repoRoot = resolveMonorepoRoot();
		const { command, args, cwd } = await resolveBuiltAuthCli(repoRoot);
		const child = spawn(command, [...args, "--provider", provider], {
			cwd,
			env: await getSpawnEnv(),
			stdio: "ignore",
			detached: true,
		});
		child.unref();

		await writeProviderAuthStatus(provider, {
			connecting: true,
			lastUpdatedAt: new Date().toISOString(),
			syncedAt: existing?.syncedAt ?? null,
			error: null,
			launcherPid: child.pid ?? null,
		});

		const startupError = await waitForAuthLoginStartup(child);
		if (startupError) {
			const latestStatus = await readPersistedAuthStatus(provider);
			const errorMessage = latestStatus?.error ?? startupError.message;
			await writeProviderAuthStatus(provider, {
				connecting: false,
				lastUpdatedAt: new Date().toISOString(),
				syncedAt: existing?.syncedAt ?? null,
				error: errorMessage,
				launcherPid: null,
			});
			throw new Error(errorMessage);
		}

		return { started: true };
	} finally {
		authLaunchInFlight.delete(provider);
	}
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

export async function getMissingRuntimeProviders(
	providers: readonly Provider[] = PROVIDER_LIST,
): Promise<Provider[]> {
	const authenticatedProviders =
		await readAuthenticatedRuntimeProviders(providers);
	const authenticatedSet = new Set(authenticatedProviders);

	return [...new Set(providers)].filter(
		(provider) => !authenticatedSet.has(provider),
	);
}

export function getAuthModuleState() {
	return {
		interactiveConnectAllowed: isInteractiveAuthLaunchAllowed(),
		remoteSyncConfigured: isRemoteSyncConfigured(),
	};
}
