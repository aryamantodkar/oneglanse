import { db, schema } from "@oneglanse/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import * as authSchema from "@oneglanse/db";
import { env } from "@/env";
import { getActiveOrganization } from "../workspace/getActiveOrganization";

const authSecret =
	env.BETTER_AUTH_SECRET ??
	(env.NEXT_PHASE === "phase-production-build"
		? "build-placeholder"
		: env.NODE_ENV === "production"
			? undefined
			: "o1Gk9Q2mR7xL4vP8sN6dF3hT5yC1uJ0wB4eK7aM2p");

const authBaseUrl =
	env.APP_URL ??
	env.NEXT_PUBLIC_API_URL ??
	(env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

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
