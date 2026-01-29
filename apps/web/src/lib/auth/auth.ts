import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@onescope/db";
import * as authSchema from "../../../../../packages/db/src/schema/auth";
import { organization } from "better-auth/plugins";
import { getActiveOrganization } from "../workspace/getActiveOrganization";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    databaseHooks: {
        session: {
            create: {
                before: async (session) => {
                    const org = await getActiveOrganization(session?.userId);
                    return {
                        data: {
                            ...session,
                            activeOrganizationId: org?.id ?? null,
                        },
                    };
                },
            },
        },
    },
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            ...schema,
            ...authSchema
        }
    }),
    plugins: [
        organization(),
        nextCookies()
    ]
});