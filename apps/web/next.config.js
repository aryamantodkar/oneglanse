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
};

export default config;