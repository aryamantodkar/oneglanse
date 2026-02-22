const DEBUG_ENABLED =
	process.env.DEBUG_ENABLED === "true" || process.env.NODE_ENV !== "production";
const SIMPLE_LOGS = process.env.SIMPLE_LOGS === "true";

function formatArgs(args: any[]) {
	return args.map((arg) =>
		arg instanceof Error ? arg.stack || arg.message : arg,
	);
}

export const logger = {
	error: (...args: any[]) => {
		if (SIMPLE_LOGS) {
			console.error("ERROR:", ...formatArgs(args));
			return;
		}
		console.error("❌", new Date().toISOString(), ...formatArgs(args));
	},

	warn: (...args: any[]) => {
		if (SIMPLE_LOGS) {
			console.warn("WARN:", ...formatArgs(args));
			return;
		}
		console.warn("⚠️", new Date().toISOString(), ...formatArgs(args));
	},

	success: (...args: any[]) => {
		if (SIMPLE_LOGS) {
			console.log("OK:", ...formatArgs(args));
			return;
		}
		console.log("✅", new Date().toISOString(), ...formatArgs(args));
	},

	log: (...args: any[]) => {
		if (SIMPLE_LOGS) {
			console.log(...formatArgs(args));
			return;
		}
		console.log(new Date().toISOString(), ...formatArgs(args));
	},

	debug: (...args: any[]) => {
		if (!DEBUG_ENABLED) return;
		if (SIMPLE_LOGS) {
			console.log("DEBUG:", ...formatArgs(args));
			return;
		}
		console.log("🐛", new Date().toISOString(), ...formatArgs(args));
	},
};
