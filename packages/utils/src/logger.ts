import { AsyncLocalStorage } from "node:async_hooks";

const DEBUG_ENABLED =
	process.env["DEBUG_ENABLED"] === "true" ||
	process.env["DEBUG_ENABLED"] === "1";

// ── Async context ─────────────────────────────────────────────────────────────
// Stores the active provider name so every logger call inside a provider's
// execution chain is automatically prefixed — no parameter threading needed.

const providerStorage = new AsyncLocalStorage<string>();

export function runWithProvider<T>(provider: string, fn: () => Promise<T>): Promise<T> {
	return providerStorage.run(provider, fn);
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

const PROVIDER_LABELS: Record<string, string> = {
	openai: "OPENAI ",
	anthropic: "CLAUDE ",
	perplexity: "PERPLEXITY   ",
	google: "GEMINI ",
	"google-ai-overview": "AI_OVERVIEW ",
};

function coloredPrefix(provider: string): string {
	const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
	const label =
		PROVIDER_LABELS[provider] ??
		provider.toUpperCase().slice(0, 7).padEnd(7);
	return `${BOLD}${color}[${label}]${R}`;
}

function contextPrefix(): string {
	const provider = providerStorage.getStore();
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
		console.log(`${contextPrefix()}${ts()}`, ...formatArgs(args));
	},

	warn: (...args: unknown[]) => {
		console.warn(`${contextPrefix()}${ts()} ${YELLOW}⚠${R}`, ...formatArgs(args));
	},

	error: (...args: unknown[]) => {
		console.error(`${contextPrefix()}${ts()} ${RED}✕${R}`, ...formatArgs(args));
	},

	success: (...args: unknown[]) => {
		console.log(`${contextPrefix()}${ts()} ${GREEN}✓${R}`, ...formatArgs(args));
	},

	debug: (...args: unknown[]) => {
		if (!DEBUG_ENABLED) return;
		console.log(`${DIM}${contextPrefix()}${ts()}${R}`, ...formatArgs(args));
	},
};

// ── Provider-colored logger ───────────────────────────────────────────────────
// Kept for explicit use-cases (e.g. BullMQ event handlers that run outside the
// runWithProvider async context).

export type ProviderLogger = typeof logger;

export function createProviderLogger(provider: string): ProviderLogger {
	const prefix = `${coloredPrefix(provider)} `;
	return {
		log: (...args) =>
			console.log(`${prefix}${ts()}`, ...formatArgs(args)),
		warn: (...args) =>
			console.warn(`${prefix}${ts()} ${YELLOW}⚠${R}`, ...formatArgs(args)),
		error: (...args) =>
			console.error(`${prefix}${ts()} ${RED}✕${R}`, ...formatArgs(args)),
		success: (...args) =>
			console.log(`${prefix}${ts()} ${GREEN}✓${R}`, ...formatArgs(args)),
		debug: (...args) => {
			if (!DEBUG_ENABLED) return;
			console.log(`${DIM}${prefix}${ts()}${R}`, ...formatArgs(args));
		},
	};
}
