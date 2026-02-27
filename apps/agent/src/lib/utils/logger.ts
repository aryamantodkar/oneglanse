import { env } from "../../env.js";

const DEBUG_ENABLED = env.DEBUG_ENABLED || env.NODE_ENV !== "production";

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
