/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

/** @type {import("next").NextConfig} */
const config = {
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
	// Prevent Next.js from bundling these server-only packages during static analysis
	serverExternalPackages: [
		"ioredis",
		"bullmq",
		"better-auth",
		"postgres",
		"@clickhouse/client",
	],
	webpack: (config) => {
		// Ensure webpack follows symlinks for workspace packages
		config.resolve.symlinks = true;
		// Ensure webpack resolves modules from node_modules
		config.resolve.modules = [
			...config.resolve.modules,
			"node_modules",
		];
		return config;
	},
};

export default config;