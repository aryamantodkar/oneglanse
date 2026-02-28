import { db, schema } from "@oneglanse/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import * as authSchema from "@oneglanse/db";
import { env } from "@/env";
import { getActiveOrganization } from "../workspace/getActiveOrganization";

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
		},
	},
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
