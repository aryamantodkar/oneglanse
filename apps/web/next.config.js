/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import path from "path";

/** @type {import("next").NextConfig} */
const config = {
	output: "standalone",
	outputFileTracingRoot: path.join(process.cwd(), "../../"),
	env: {
		// Pass SKIP_ENV_VALIDATION to the runtime so it's not inlined as undefined
		SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
	},
	transpilePackages: [
		"@onescope/ui",
		"@onescope/utils",
		"@onescope/db",
		"@onescope/errors",
		"@onescope/services",
		"@onescope/types",
	],
	webpack: (config) => {
		// Ensure webpack follows symlinks for workspace packages
		config.resolve.symlinks = true;
		// Ensure webpack resolves modules from node_modules
		config.resolve.modules = [...config.resolve.modules, "node_modules"];
		return config;
	},
};

export default config;
