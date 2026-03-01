const DEBUG_ENABLED =
	process.env["DEBUG_ENABLED"] === "true" ||
	process.env["DEBUG_ENABLED"] === "1";

// ── Provider context hook ─────────────────────────────────────────────────────
// Logger is browser-safe: it never imports node:async_hooks.
// The agent runtime installs a getter via setProviderContextGetter() at startup;
// web app code leaves it unset and contextPrefix() returns an empty string.

let _getContext: (() => string | undefined) | null = null;

/** Call once at agent startup to wire AsyncLocalStorage into the logger. */
export function setProviderContextGetter(fn: () => string | undefined): void {
	_getContext = fn;
}

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const R = "\x1b[0m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";

const PROVIDER_COLORS: Record<string, string> = {
	openai: "\x1b[32m",
	anthropic: "\x1b[35m",
	perplexity: "\x1b[36m",
	google: "\x1b[33m",
	"google-ai-overview": "\x1b[34m",
};

const RAW_PROVIDER_LABELS: Record<string, string> = {
	openai: "OPENAI",
	anthropic: "CLAUDE",
	perplexity: "PERPLEXITY",
	google: "GEMINI",
	"google-ai-overview": "AI OVERVIEW",
};

function centerLabel(label: string, width: number): string {
	const totalPadding = width - label.length;
	if (totalPadding <= 0) return label;

	const left = Math.floor(totalPadding / 2);
	const right = totalPadding - left;

	return " ".repeat(left) + label + " ".repeat(right);
}

export const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
	Object.entries(RAW_PROVIDER_LABELS).map(([key, label]) => [
		key,
		centerLabel(label, 12),
	]),
);

function coloredPrefix(provider: string): string {
	const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
	const label =
		PROVIDER_LABELS[provider] ??
		provider.toUpperCase().slice(0, 11).padEnd(11);
	return `${BOLD}${color}[${label}]${R}`;
}

function contextPrefix(): string {
	const provider = _getContext?.();
	return provider ? `${coloredPrefix(provider)} ` : "";
}

function formatArgs(args: unknown[]) {
	return args.map((arg) =>
		arg instanceof Error ? arg.stack || arg.message : arg,
	);
}

function ts(): string {
	return new Date().toISOString();
}

// ── Global logger ─────────────────────────────────────────────────────────────

export const logger = {
	log: (...args: unknown[]) => {
		console.log(`${ts()} ${contextPrefix()}`, ...formatArgs(args));
	},

	warn: (...args: unknown[]) => {
		console.warn(
			`${ts()} ${contextPrefix()} ${YELLOW}⚠${R}`,
			...formatArgs(args),
		);
	},

	error: (...args: unknown[]) => {
		console.error(
			`${ts()} ${contextPrefix()} ${RED}✕${R}`,
			...formatArgs(args),
		);
	},

	success: (...args: unknown[]) => {
		console.log(
			`${ts()} ${contextPrefix()} ${GREEN}✓${R}`,
			...formatArgs(args),
		);
	},

	debug: (...args: unknown[]) => {
		if (!DEBUG_ENABLED) return;
		console.log(
			`${ts()} ${DIM}${contextPrefix()}${R}`,
			...formatArgs(args),
		);
	},
};

// ── Provider-colored logger ───────────────────────────────────────────────────
// Kept for explicit use-cases (e.g. BullMQ event handlers that run outside the
// provider async context).

export type ProviderLogger = typeof logger;
export function createProviderLogger(provider: string): ProviderLogger {
	const prefix = coloredPrefix(provider);

	return {
		log: (...args) =>
			console.log(`${ts()} ${prefix}`, ...formatArgs(args)),

		warn: (...args) =>
			console.warn(
				`${ts()} ${prefix} ${YELLOW}⚠${R}`,
				...formatArgs(args),
			),

		error: (...args) =>
			console.error(
				`${ts()} ${prefix} ${RED}✕${R}`,
				...formatArgs(args),
			),

		success: (...args) =>
			console.log(
				`${ts()} ${prefix} ${GREEN}✓${R}`,
				...formatArgs(args),
			),

		debug: (...args) => {
			if (!DEBUG_ENABLED) return;
			console.log(
				`${ts()} ${DIM}${prefix}${R}`,
				...formatArgs(args),
			);
		},
	};
}