const DEBUG_ENABLED =
	process.env["DEBUG_ENABLED"] === "true" ||
	process.env["DEBUG_ENABLED"] === "1" ||
	process.env["NODE_ENV"] !== "production";

function formatArgs(args: unknown[]) {
	return args.map((arg) =>
		arg instanceof Error ? arg.stack || arg.message : arg,
	);
}

export const logger = {
	error: (...args: unknown[]) => {
		console.error("❌", new Date().toISOString(), ...formatArgs(args));
	},

	warn: (...args: unknown[]) => {
		console.warn("⚠️", new Date().toISOString(), ...formatArgs(args));
	},

	success: (...args: unknown[]) => {
		console.log("✅", new Date().toISOString(), ...formatArgs(args));
	},

	log: (...args: unknown[]) => {
		console.log(new Date().toISOString(), ...formatArgs(args));
	},

	debug: (...args: unknown[]) => {
		if (!DEBUG_ENABLED) return;
		console.log("🐛", new Date().toISOString(), ...formatArgs(args));
	},
};

// ── Provider-colored logger ───────────────────────────────────────────────────

const ANSI_RESET = "\x1b[0m";

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
	perplexity: "PPLX   ",
	google: "GEMINI ",
	"google-ai-overview": "AIOVER ",
};

function coloredPrefix(provider: string): string {
	const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
	const label =
		PROVIDER_LABELS[provider] ??
		provider.toUpperCase().slice(0, 7).padEnd(7);
	return `${color}[${label}]${ANSI_RESET}`;
}

export type ProviderLogger = typeof logger;

export function createProviderLogger(provider: string): ProviderLogger {
	const prefix = coloredPrefix(provider);
	return {
		error: (...args) =>
			console.error("❌", prefix, new Date().toISOString(), ...formatArgs(args)),
		warn: (...args) =>
			console.warn("⚠️ ", prefix, new Date().toISOString(), ...formatArgs(args)),
		success: (...args) =>
			console.log("✅", prefix, new Date().toISOString(), ...formatArgs(args)),
		log: (...args) =>
			console.log(prefix, new Date().toISOString(), ...formatArgs(args)),
		debug: (...args) => {
			if (!DEBUG_ENABLED) return;
			console.log("🐛", prefix, new Date().toISOString(), ...formatArgs(args));
		},
	};
}
