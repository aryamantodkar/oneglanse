import { env } from "@/env";
import { db, schema } from "@oneglanse/db";
import * as authSchema from "@oneglanse/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { getActiveOrganization } from "../workspace/getActiveOrganization";

const isBuildTime =
	process.env.SKIP_ENV_VALIDATION === "true" ||
	process.env.npm_lifecycle_event === "build" ||
	(process.argv.includes("next") && process.argv.includes("build"));

const authSecret =
	env.BETTER_AUTH_SECRET ??
	(env.NODE_ENV === "production" && !isBuildTime
		? undefined
		: "build-only-auth-secret-0123456789abcdef0123456789abcdef");

const authBaseUrl =
	env.APP_URL ??
	env.API_BASE_URL ??
	process.env.BETTER_AUTH_URL?.trim() ??
	(env.NODE_ENV === "production" && !isBuildTime
		? undefined
		: "http://localhost:3000");

const socialProviders =
	env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? {
				google: {
					clientId: env.GOOGLE_CLIENT_ID,
					clientSecret: env.GOOGLE_CLIENT_SECRET,
				},
			}
		: {};

export const auth = betterAuth({
	...(authBaseUrl ? { baseURL: authBaseUrl } : {}),
	secret: authSecret,
	socialProviders,
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const organization = await getActiveOrganization(session?.userId);
					return {
						data: {
							...session,
							activeOrganizationId: organization?.id ?? null,
						},
					};
				},
			},
		},
	},
	database: drizzleAdapter(db, {
		provider: "pg", // or "mysql", "sqlite"
		schema: {
			...schema,
			...authSchema,
		},
	}),
	plugins: [organization(), nextCookies()],
});
